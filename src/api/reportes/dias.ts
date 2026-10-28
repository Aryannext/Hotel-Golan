// FR-16 / RN-15: el informe suma los turnos recibidos que comenzaron en [06:30, 06:30).
// Los pagos se atribuyen a su turno, incluso si se verifican o anulan después.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { ErrorApi } from '../comun/errores.ts';
import { aBogota } from '../comun/tiempo.ts';

interface Dia {
  dia: string; turnos: Array<{ tipo: string; responsable: string }>;
  efectivo: number; transferencias_verificadas: number; transferencias_pendientes: number; transferencias_devueltas: number;
  descuentos: number; salidas: number; diferencias: number;
}

export function rutasReportes(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get<{ Querystring: { desde: string; hasta: string } }>('/reportes/dias', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { querystring: {
      type: 'object', additionalProperties: false, required: ['desde', 'hasta'],
      properties: { desde: { type: 'string', format: 'date' }, hasta: { type: 'string', format: 'date' } },
    } },
  }, async (req) => {
    const { desde, hasta } = req.query;
    if (desde > hasta) throw new ErrorApi(400, 'INVALID_PAYLOAD', 'La fecha inicial debe ser anterior o igual a la final.');
    // Cada tabla se suma por separado para no multiplicar pagos al unirlos con cargos o salidas.
    // Los descuentos se crean al registrar la entrada y pertenecen al turno de esa estadía.
    // Las diferencias son las guardadas al entregar: una anulación posterior no reescribe el conteo.
    // HAL-17 (decisión del usuario, 27-10-2026): una devolución por transferencia se resta de las transferencias del día
    // en que se devuelve; el día del cobro no se reescribe. Un día puede tener solo devoluciones (FULL JOIN).
    const filas = await bd.consultar<Dia>(`
      WITH por_turno AS (
        SELECT t.id, t.tipo, u.usuario AS responsable, t.inicio_en,
               (t.inicio_en AT TIME ZONE 'America/Bogota' - interval '6 hours 30 minutes')::date AS dia,
               p.efectivo, p.verificadas, p.pendientes, m.salidas, c.descuentos,
               CASE WHEN t.estado = 'CERRADO' THEN t.efectivo_contado - t.efectivo_esperado ELSE 0 END AS diferencia
          FROM turnos t JOIN usuarios u ON u.id = t.responsable_id
          CROSS JOIN LATERAL (
            SELECT coalesce(sum(valor) FILTER (WHERE estado = 'EN_CAJA'), 0) AS efectivo,
                   coalesce(sum(valor) FILTER (WHERE estado = 'VERIFICADO'), 0) AS verificadas,
                   coalesce(sum(valor) FILTER (WHERE estado = 'POR_VERIFICAR'), 0) AS pendientes
              FROM pagos WHERE turno_id = t.id AND anulado_en IS NULL
          ) p
          CROSS JOIN LATERAL (
            SELECT coalesce(sum(valor), 0) AS salidas FROM movimientos_caja WHERE turno_id = t.id AND anulado_en IS NULL
          ) m
          CROSS JOIN LATERAL (
            SELECT coalesce(-sum(c.valor), 0) AS descuentos FROM cargos c JOIN estadias e ON e.id = c.estadia_id
             WHERE e.turno_id = t.id AND c.tipo = 'DESCUENTO' AND c.anulado_en IS NULL
          ) c
         WHERE t.estado <> 'POR_RECIBIR'
           AND t.inicio_en >= ($1::date + time '06:30') AT TIME ZONE 'America/Bogota'
           AND t.inicio_en < ($2::date + 1 + time '06:30') AT TIME ZONE 'America/Bogota'
      ), dias AS (
        SELECT dia, jsonb_agg(jsonb_build_object('tipo', tipo, 'responsable', responsable) ORDER BY inicio_en, id) AS turnos,
               sum(efectivo) AS efectivo, sum(verificadas) AS verificadas, sum(pendientes) AS pendientes,
               sum(descuentos) AS descuentos, sum(salidas) AS salidas, sum(diferencia) AS diferencias
          FROM por_turno GROUP BY dia
      ), devueltas AS (
        SELECT (registrada_en AT TIME ZONE 'America/Bogota' - interval '6 hours 30 minutes')::date AS dia, sum(valor) AS devueltas
          FROM devoluciones
         WHERE medio = 'TRANSFERENCIA' AND valor > 0
           AND registrada_en >= ($1::date + time '06:30') AT TIME ZONE 'America/Bogota'
           AND registrada_en < ($2::date + 1 + time '06:30') AT TIME ZONE 'America/Bogota'
         GROUP BY 1
      )
      SELECT dia::text, coalesce(d.turnos, '[]'::jsonb) AS turnos, coalesce(d.efectivo, 0)::int AS efectivo,
             (coalesce(d.verificadas, 0) - coalesce(v.devueltas, 0))::int AS transferencias_verificadas,
             coalesce(d.pendientes, 0)::int AS transferencias_pendientes, coalesce(v.devueltas, 0)::int AS transferencias_devueltas,
             coalesce(d.descuentos, 0)::int AS descuentos, coalesce(d.salidas, 0)::int AS salidas, coalesce(d.diferencias, 0)::int AS diferencias
        FROM dias d FULL JOIN devueltas v USING (dia) ORDER BY dia`, [desde, hasta]);
    return { items: filas.map((d) => {
      const inicio = new Date(`${d.dia}T06:30:00-05:00`);
      return { ...d, desde: aBogota(inicio), hasta: aBogota(new Date(inicio.getTime() + 86_400_000)) };
    }) };
  });
}
