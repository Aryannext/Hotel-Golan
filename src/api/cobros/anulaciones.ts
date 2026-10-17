// Anulaciones (FR-17, FR-20; ADR-008): la administración anula un cobro o una salida de dinero con motivo.
// Nada se borra: el registro sigue visible, marcado como anulado, y la caja y la cuenta se recalculan solas
// porque todas las sumas excluyen lo anulado.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { ErrorApi } from '../comun/errores.ts';
import { leerPagos } from './pagos.ts';
import { leerMovimientos } from '../caja/movimientos.ts';

const esquema = {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: { type: 'object', additionalProperties: false, required: ['motivo'], properties: { motivo: { type: 'string', minLength: 5, maxLength: 200 } } },
};

const evento = (tx: Bd, tipo: string, payload: Record<string, unknown>, momento: Date) =>
  tx.consultar('INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)', [tipo, JSON.stringify(payload), momento]);

export function rutasAnulaciones(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const soloAdministracion = requiere(bd, ahora, ['ADMINISTRACION']);

  app.post<{ Params: { id: string }; Body: { motivo: string } }>('/pagos/:id/anulacion', { preHandler: soloAdministracion, schema: esquema }, async (req) => {
    const u = req.usuario!;
    const momento = ahora();
    await bd.transaccion(async (tx) => {
      // El pago puede ser de una venta de contado (sin habitación, TICKET-22): anularlo anula la venta.
      const [p] = await tx.consultar<{ medio: string; valor: number; anulado_en: Date | null; habitacion: string | null; estadia_id: string | null }>(
        `SELECT p.medio, p.valor, p.anulado_en, e.habitacion_numero AS habitacion, p.estadia_id
           FROM pagos p LEFT JOIN estadias e ON e.id = p.estadia_id WHERE p.id = $1 FOR UPDATE OF p`, [req.params.id]);
      if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El pago no existe.');
      if (p.anulado_en) throw new ErrorApi(409, 'CONFLICTO', 'Ese pago ya estaba anulado.');
      await tx.consultar('UPDATE pagos SET anulado_en = $2, anulado_por = $3, motivo_anulacion = $4 WHERE id = $1',
        [req.params.id, momento, u.id, req.body.motivo.trim()]);
      // El motivo queda en el registro; la auditoría guarda solo el valor (el texto libre podría traer datos personales).
      await auditar(tx, { usuarioId: u.id, accion: 'ANULAR', entidad: 'pagos', entidadId: req.params.id, detalle: { valor: String(p.valor), medio: p.medio }, ocurrido: momento });
      if (p.estadia_id) await evento(tx, 'habitacion.actualizada', { numero: p.habitacion, entidad_id: p.estadia_id }, momento);
      if (p.medio === 'EFECTIVO') await evento(tx, 'caja.movimiento', { entidad_id: req.params.id, valor: p.valor, habitacion_numero: p.habitacion }, momento);
    });
    const [pago] = await leerPagos(bd, { id: req.params.id });
    return pago;
  });

  app.post<{ Params: { id: string }; Body: { motivo: string } }>('/movimientos_caja/:id/anulacion', { preHandler: soloAdministracion, schema: esquema }, async (req) => {
    const u = req.usuario!;
    const momento = ahora();
    await bd.transaccion(async (tx) => {
      const [m] = await tx.consultar<{ tipo: string; valor: number; anulado_en: Date | null; habitacion_numero: string | null }>(
        'SELECT tipo, valor, anulado_en, habitacion_numero FROM movimientos_caja WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!m) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La salida de dinero no existe.');
      if (m.anulado_en) throw new ErrorApi(409, 'CONFLICTO', 'Esa salida ya estaba anulada.');
      // Una devolución está ligada a la estadía que desistió; anularla aquí dejaría la devolución sin su salida. [P]
      if (m.tipo === 'DEVOLUCION') throw new ErrorApi(409, 'CONFLICTO', 'La salida de una devolución no se anula por aquí: está ligada al desistimiento de la estadía.');
      await tx.consultar('UPDATE movimientos_caja SET anulado_en = $2, anulado_por = $3, motivo_anulacion = $4 WHERE id = $1',
        [req.params.id, momento, u.id, req.body.motivo.trim()]);
      await auditar(tx, { usuarioId: u.id, accion: 'ANULAR', entidad: 'movimientos_caja', entidadId: req.params.id, detalle: { valor: String(m.valor), tipo: m.tipo }, ocurrido: momento });
      await evento(tx, 'caja.movimiento', { entidad_id: req.params.id, valor: m.valor, habitacion_numero: m.habitacion_numero }, momento);
    });
    const [mov] = await leerMovimientos(bd, { id: req.params.id });
    return mov;
  });
}
