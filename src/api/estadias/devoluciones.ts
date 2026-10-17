// Desistimiento y devolución (FR-10; RN-08): «solo miró» devuelve todo lo pagado; «ya la usó», nada.
// En efectivo la devuelve la persona del turno con una salida de caja DEVOLUCION ligada a la estadía. Si pagó por
// transferencia, se espera la verificación y la administración decide el medio.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota, horaTexto } from '../comun/tiempo.ts';
import { ErrorApi, sinPermiso } from '../comun/errores.ts';
import { conIdempotencia } from '../comun/idempotencia.ts';
import { turnoAbiertoId } from '../caja/turnos.ts';
import { estadiaActiva } from './cargos.ts';
import { publicarEventos } from '../comun/eventos.ts';

interface Cuerpo { motivo: 'SOLO_MIRO' | 'YA_USO'; medio: 'EFECTIVO' | 'TRANSFERENCIA' }

export function rutasDevoluciones(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.post<{ Params: { id: string }; Body: Cuerpo; Headers: { 'idempotency-key'?: string } }>('/estadias/:id/devoluciones', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      headers: { type: 'object', properties: { 'idempotency-key': { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object', additionalProperties: false, required: ['motivo', 'medio'],
        properties: { motivo: { type: 'string', enum: ['SOLO_MIRO', 'YA_USO'] }, medio: { type: 'string', enum: ['EFECTIVO', 'TRANSFERENCIA'] } },
      },
    },
  }, async (req, rep) => {
    const u = req.usuario!;
    const id = req.params.id;
    const { motivo, medio } = req.body;
    const r = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'registrarDevolucion', async (tx) => {
      const momento = ahora();
      const est = await estadiaActiva(tx, id);
      const [p] = await tx.consultar<{ efectivo: number; transferencias: number; por_verificar: number }>(
        `SELECT coalesce(sum(valor) FILTER (WHERE estado = 'EN_CAJA'), 0)::int AS efectivo,
                coalesce(sum(valor) FILTER (WHERE estado = 'VERIFICADO'), 0)::int AS transferencias,
                count(*) FILTER (WHERE estado = 'POR_VERIFICAR')::int AS por_verificar
           FROM pagos WHERE estadia_id = $1 AND anulado_en IS NULL`, [id]);

      // Nunca más de lo pagado; si ya la usó, nada (RN-08).
      const valor = motivo === 'SOLO_MIRO' ? p.efectivo + p.transferencias : 0;
      if (motivo === 'SOLO_MIRO') {
        if (p.por_verificar > 0) {
          throw new ErrorApi(409, 'PAGO_SIN_VERIFICAR', 'Pagó por transferencia y todavía no se ha confirmado. Espere a que la administración la verifique.');
        }
        const esAdmin = u.rol === 'ADMINISTRACION';
        if (!esAdmin && (medio === 'TRANSFERENCIA' || p.transferencias > 0)) {
          throw sinPermiso();
        }
      }

      let movimientoId: string | null = null;
      if (valor > 0 && medio === 'EFECTIVO') {
        const turnoId = await turnoAbiertoId(tx);
        [{ id: movimientoId }] = await tx.consultar<{ id: string }>(
          `INSERT INTO movimientos_caja (turno_id, tipo, detalle, valor, habitacion_numero, registrado_por, registrado_en)
           VALUES ($1, 'DEVOLUCION', 'Desistimiento: solo miró la habitación', $2, $3, $4, $5) RETURNING id`,
          [turnoId, valor, est.habitacion_numero, u.id, momento]);
      }
      const [d] = await tx.consultar<{ id: string }>(
        `INSERT INTO devoluciones (estadia_id, motivo, valor, medio, movimiento_caja_id, registrada_por, registrada_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [id, motivo, valor, medio, movimientoId, u.id, momento]);
      await tx.consultar(`UPDATE estadias SET estado = 'DESISTIDA', salida_real_en = $2 WHERE id = $1`, [id, momento]);
      await tx.consultar(`UPDATE habitaciones SET estado = 'POR_REVISAR', nota = $2, actualizado_en = $3 WHERE numero = $1`,
        [est.habitacion_numero, `Desistió a las ${horaTexto(momento)}`, momento]);
      await auditar(tx, {
        usuarioId: u.id, accion: 'CREAR', entidad: 'devoluciones', entidadId: d.id, ocurrido: momento,
        detalle: { estadia: id, motivo, medio, valor: String(valor) },
      });
      const eventos: Array<[string, Record<string, unknown>]> = [
        ['estadia.cerrada', { entidad_id: id, habitacion_numero: est.habitacion_numero }],
        ['habitacion.actualizada', { numero: est.habitacion_numero, estado: 'POR_REVISAR' }],
      ];
      if (movimientoId) eventos.push(['caja.movimiento', { entidad_id: movimientoId, valor, habitacion_numero: est.habitacion_numero }]);
      await publicarEventos(tx, eventos, momento);
      return {
        estado: 201,
        cuerpo: {
          id: d.id, estadia_id: id, motivo, valor, medio, movimiento_caja_id: movimientoId,
          registrada_por: u.usuario, registrada_en: aBogota(momento),
        },
      };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });
}
