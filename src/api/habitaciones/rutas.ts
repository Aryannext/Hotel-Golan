// GET /habitaciones (FR-01). La cuenta resumida sigue la regla del ticket 06:
// saldo = cargos − (pagos en caja o verificados + pagos por verificar); los rechazados y anulados no cuentan.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { aBogota } from '../comun/tiempo.ts';

const ESTADOS = ['DISPONIBLE', 'OCUPADA', 'POR_REVISAR', 'LIMPIEZA', 'MANTENIMIENTO'] as const;

interface Fila {
  numero: string; tipo: string; estado: string; nota: string | null;
  estadia_id: string | null; nombre: string | null; anonimizado_en: Date | null; salida_prevista_en: Date | null;
  cargos: number; pagado: number; por_verificar: number;
}

export function nombreCorto(nombre: string | null, anonimizado: boolean): string {
  if (anonimizado || !nombre) return 'Huésped anonimizado';
  return nombre.trim().split(/\s+/).slice(0, 2).join(' ');
}

export function rutasHabitaciones(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get<{ Querystring: { estado?: string } }>('/habitaciones', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      querystring: { type: 'object', additionalProperties: false, properties: { estado: { type: 'string', enum: [...ESTADOS] } } },
    },
  }, async (req) => {
    const filas = await bd.consultar<Fila>(
      `SELECT h.numero, h.tipo, h.estado, h.nota,
              e.id AS estadia_id, hu.nombre, hu.anonimizado_en, e.salida_prevista_en,
              coalesce((SELECT sum(c.valor) FROM cargos c WHERE c.estadia_id = e.id AND c.anulado_en IS NULL), 0)::int AS cargos,
              coalesce((SELECT sum(p.valor) FROM pagos p WHERE p.estadia_id = e.id AND p.anulado_en IS NULL
                          AND p.estado IN ('EN_CAJA', 'VERIFICADO')), 0)::int AS pagado,
              coalesce((SELECT sum(p.valor) FROM pagos p WHERE p.estadia_id = e.id AND p.anulado_en IS NULL
                          AND p.estado = 'POR_VERIFICAR'), 0)::int AS por_verificar
         FROM habitaciones h
         LEFT JOIN estadias e ON e.habitacion_numero = h.numero AND e.estado = 'ACTIVA'
         LEFT JOIN huespedes hu ON hu.id = e.huesped_id
        WHERE ($1::text IS NULL OR h.estado = $1)
        ORDER BY h.numero`,
      [req.query.estado ?? null]);
    const t = ahora();
    return {
      items: filas.map((f) => ({
        numero: f.numero, tipo: f.tipo, estado: f.estado, nota: f.nota,
        estadia_activa: f.estadia_id && f.salida_prevista_en ? {
          id: f.estadia_id,
          nombre_corto: nombreCorto(f.nombre, !!f.anonimizado_en),
          salida_prevista_en: aBogota(new Date(f.salida_prevista_en)),
          saldo: Math.max(0, f.cargos - f.pagado - f.por_verificar),
          por_verificar: f.por_verificar,
          vencida: t > new Date(f.salida_prevista_en),
        } : null,
      })),
    };
  });
}
