// Pagos (FR-07, FR-15; RN-12): listar y confirmar si una transferencia llegó. La regla de verificación (Inbox/Outbox)
// es la misma que se probó en la Fase 1.5 (scripts/lib/verificacion.ts).
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { verificarPago, type ResultadoVerificacion } from '../../../scripts/lib/verificacion.ts';
import { requiere } from '../identidad/sesiones.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { auditar } from '../comun/auditoria.ts';
import { conIdempotencia } from '../comun/idempotencia.ts';
import { turnoAbiertoId } from '../caja/turnos.ts';
import { estadiaActiva } from '../estadias/cargos.ts';
import { leerEstadia } from '../estadias/estadias.ts';
import { publicarEventos } from '../comun/eventos.ts';

interface FilaPago {
  id: string; estadia_id: string; habitacion_numero: string; turno_id: string; medio: string; valor: number; estado: string;
  registrado_por: string; registrado_en: Date; verificado_por: string | null; verificado_en: Date | null; anulado: boolean;
}

export async function leerPagos(bd: Bd, filtro: { id?: string; estado?: string; turnoId?: string }) {
  const filas = await bd.consultar<FilaPago>(
    `SELECT p.id, p.estadia_id, e.habitacion_numero, p.turno_id, p.medio, p.valor, p.estado, r.usuario AS registrado_por, p.registrado_en,
            v.usuario AS verificado_por, p.verificado_en, p.anulado_en IS NOT NULL AS anulado
       FROM pagos p JOIN estadias e ON e.id = p.estadia_id JOIN usuarios r ON r.id = p.registrado_por
       LEFT JOIN usuarios v ON v.id = p.verificado_por
      WHERE ($1::uuid IS NULL OR p.id = $1) AND ($2::text IS NULL OR p.estado = $2) AND ($3::uuid IS NULL OR p.turno_id = $3)
      ORDER BY p.registrado_en, p.id`,
    [filtro.id ?? null, filtro.estado ?? null, filtro.turnoId ?? null]);
  return filas.map((f) => ({
    ...f, registrado_en: aBogota(new Date(f.registrado_en)), verificado_en: f.verificado_en ? aBogota(new Date(f.verificado_en)) : null,
  }));
}

export function rutasPagos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get<{ Querystring: { estado?: string; turno_id?: string } }>('/pagos', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      querystring: {
        type: 'object', additionalProperties: false,
        properties: {
          estado: { type: 'string', enum: ['EN_CAJA', 'POR_VERIFICAR', 'VERIFICADO', 'RECHAZADO'] },
          turno_id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (req) => {
    // Lo anulado no está «por confirmar».
    const items = await leerPagos(bd, { estado: req.query.estado, turnoId: req.query.turno_id });
    return { items: req.query.estado === 'POR_VERIFICAR' ? items.filter((p) => !p.anulado) : items };
  });

  app.post<{ Params: { id: string }; Body: { resultado: ResultadoVerificacion }; Headers: { 'idempotency-key'?: string } }>('/pagos/:id/verificacion', {
    // Solo la administración confirma (RN-12).
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      body: { type: 'object', additionalProperties: false, required: ['resultado'], properties: { resultado: { type: 'string', enum: ['LLEGO', 'NO_LLEGO'] } } },
      headers: { type: 'object', properties: { 'idempotency-key': { type: 'string', format: 'uuid' } } },
    },
  }, async (req) => {
    try {
      await verificarPago(bd, {
        pagoId: req.params.id, resultado: req.body.resultado, usuarioId: req.usuario!.id,
        clave: req.headers['idempotency-key'] ?? randomUUID(), momento: ahora(),
      });
    } catch (error) {
      const m = error instanceof Error ? error.message : '';
      if (m.startsWith('NO_ENCONTRADO')) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El pago no existe.');
      if (m.startsWith('CONFLICTO')) throw new ErrorApi(409, 'CONFLICTO', 'Ese pago ya no está por confirmar (ya se confirmó, se anuló o fue en efectivo).');
      throw error;
    }
    const [pago] = await leerPagos(bd, { id: req.params.id });
    return pago;
  });

  // Pago o abono a la cuenta (FR-07): efectivo → EN_CAJA; transferencia → POR_VERIFICAR (RN-10, RN-12).
  app.post<{ Params: { id: string }; Body: { medio: 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA'; valor: number }; Headers: { 'idempotency-key'?: string } }>('/estadias/:id/pagos', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      headers: { type: 'object', properties: { 'idempotency-key': { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object', additionalProperties: false, required: ['medio', 'valor'],
        properties: { medio: { type: 'string', enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'] }, valor: { type: 'integer', minimum: 1, maximum: 100000000 } },
      },
    },
  }, async (req, rep) => {
    const u = req.usuario!;
    const { medio, valor } = req.body;
    const r = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'registrarPago', async (tx) => {
      const momento = ahora();
      const turnoId = await turnoAbiertoId(tx);
      const est = await estadiaActiva(tx, req.params.id);
      const { cuenta } = (await leerEstadia(tx, req.params.id))!;
      // Lo que sobra se devuelve como vueltas en la recepción; la cuenta no queda con saldo a favor.
      if (valor > cuenta.saldo) {
        throw new ErrorApi(409, 'CONFLICTO', cuenta.saldo === 0
          ? 'La cuenta está al día: no hay nada por cobrar.'
          : `El pago supera lo que se debe. El saldo es de $${cuenta.saldo.toLocaleString('es-CO')}.`);
      }
      const efectivo = medio === 'EFECTIVO';
      const [p] = await tx.consultar<{ id: string }>(
        `INSERT INTO pagos (estadia_id, turno_id, medio, valor, estado, registrado_por, registrado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.params.id, turnoId, medio, valor, efectivo ? 'EN_CAJA' : 'POR_VERIFICAR', u.id, momento]);
      await auditar(tx, {
        usuarioId: u.id, accion: 'CREAR', entidad: 'pagos', entidadId: p.id, detalle: { medio, valor: String(valor) }, ocurrido: momento,
      });
      const eventos: Array<[string, Record<string, unknown>]> = [['habitacion.actualizada', { numero: est.habitacion_numero, entidad_id: req.params.id }]];
      if (!efectivo) eventos.push(['pago.por_verificar', { entidad_id: p.id, habitacion_numero: est.habitacion_numero, valor }]);
      await publicarEventos(tx, eventos, momento);
      const [pago] = await leerPagos(tx, { id: p.id });
      return { estado: 201, cuerpo: pago };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });
}
