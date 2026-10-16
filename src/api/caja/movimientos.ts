// Salidas de dinero de la caja (FR-12; RN-10, RN-14): bajan el «debe haber» y no cuentan como ventas.
// Las devoluciones no se crean aquí: salen de /estadias/{id}/devoluciones (TICKET-09).
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { conIdempotencia } from '../comun/idempotencia.ts';
import { turnoAbiertoId } from './turnos.ts';

const HABITACIONES = ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '301'];

interface Fila {
  id: string; turno_id: string; tipo: string; detalle: string; valor: number; habitacion_numero: string | null;
  registrado_por: string; registrado_en: Date; anulado: boolean;
}

async function leerMovimientos(bd: Bd, filtro: { id?: string; turnoId?: string }) {
  const filas = await bd.consultar<Fila>(
    `SELECT m.id, m.turno_id, m.tipo, m.detalle, m.valor, m.habitacion_numero, u.usuario AS registrado_por, m.registrado_en,
            m.anulado_en IS NOT NULL AS anulado
       FROM movimientos_caja m JOIN usuarios u ON u.id = m.registrado_por
      WHERE ($1::uuid IS NULL OR m.id = $1) AND ($2::uuid IS NULL OR m.turno_id = $2)
      ORDER BY m.registrado_en, m.id`,
    [filtro.id ?? null, filtro.turnoId ?? null]);
  return filas.map((f) => ({ ...f, registrado_en: aBogota(new Date(f.registrado_en)) }));
}

interface Cuerpo { tipo: 'COMPRA_HOTEL' | 'RETIRO_ADMINISTRACION' | 'RECARGO_ASEO' | 'OTRO'; detalle: string; valor: number; habitacion_numero?: string }

export function rutasMovimientos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const sesion = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);

  app.get<{ Querystring: { turno_id?: string } }>('/movimientos_caja', {
    preHandler: sesion,
    schema: { querystring: { type: 'object', additionalProperties: false, properties: { turno_id: { type: 'string', format: 'uuid' } } } },
  }, async (req) => {
    // Sin turno_id: las del turno activo (lo que ve recepción en su caja).
    let turnoId = req.query.turno_id;
    if (!turnoId) {
      const [t] = await bd.consultar<{ id: string }>(`SELECT id FROM turnos WHERE estado IN ('POR_RECIBIR', 'ABIERTO')`);
      if (!t) return { items: [] };
      turnoId = t.id;
    }
    return { items: await leerMovimientos(bd, { turnoId }) };
  });

  app.post<{ Body: Cuerpo; Headers: { 'idempotency-key'?: string } }>('/movimientos_caja', {
    preHandler: sesion,
    schema: {
      headers: { type: 'object', properties: { 'idempotency-key': { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object', additionalProperties: false, required: ['tipo', 'detalle', 'valor'],
        properties: {
          tipo: { type: 'string', enum: ['COMPRA_HOTEL', 'RETIRO_ADMINISTRACION', 'RECARGO_ASEO', 'OTRO'] },
          detalle: { type: 'string', minLength: 3, maxLength: 200 },
          valor: { type: 'integer', minimum: 1, maximum: 100000000 },
          habitacion_numero: { type: 'string', enum: HABITACIONES },
        },
        // El recargo de aseo se entrega por la limpieza de una habitación concreta (RN-14). [P]
        if: { properties: { tipo: { const: 'RECARGO_ASEO' } } },
        then: { required: ['habitacion_numero'] },
      },
    },
  }, async (req, rep) => {
    const u = req.usuario!;
    const b = req.body;
    const r = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'registrarMovimientoCaja', async (tx) => {
      const momento = ahora();
      const turnoId = await turnoAbiertoId(tx);
      const [m] = await tx.consultar<{ id: string }>(
        `INSERT INTO movimientos_caja (turno_id, tipo, detalle, valor, habitacion_numero, registrado_por, registrado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [turnoId, b.tipo, b.detalle.trim(), b.valor, b.habitacion_numero ?? null, u.id, momento]);
      // La auditoría guarda el tipo y el valor, no el detalle escrito a mano (podría traer datos personales).
      await auditar(tx, { usuarioId: u.id, accion: 'CREAR', entidad: 'movimientos_caja', entidadId: m.id, detalle: { tipo: b.tipo, valor: String(b.valor) }, ocurrido: momento });
      await tx.consultar('INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)',
        ['caja.movimiento', JSON.stringify({ entidad_id: m.id, valor: b.valor, habitacion_numero: b.habitacion_numero ?? null }), momento]);
      const [mov] = await leerMovimientos(tx, { id: m.id });
      return { estado: 201, cuerpo: mov };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });
}
