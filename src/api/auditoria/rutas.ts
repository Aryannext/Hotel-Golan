// GET /auditoria (FR-20): quién hizo qué, cuándo y sobre qué. Solo la administración.
// El detalle se guarda sin datos personales (ADR-006); aquí se devuelve tal cual, con el usuario y no su nombre.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { aBogota } from '../comun/tiempo.ts';

interface FilaAuditoria { id: string; usuario: string | null; accion: string; entidad: string; entidad_id: string; ocurrido_en: Date; detalle: Record<string, string> }

export function rutasAuditoria(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get<{ Querystring: { limite: number; desplazamiento: number; entidad?: string } }>('/auditoria', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { querystring: {
      type: 'object', additionalProperties: false,
      properties: {
        limite: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        desplazamiento: { type: 'integer', minimum: 0, default: 0 },
        entidad: { type: 'string', maxLength: 40 },
      },
    } },
  }, async (req) => {
    const { limite, desplazamiento, entidad = null } = req.query;
    const [{ total }] = await bd.consultar<{ total: number }>(
      'SELECT count(*)::int AS total FROM auditoria WHERE $1::text IS NULL OR entidad = $1', [entidad]);
    const filas = await bd.consultar<FilaAuditoria>(
      `SELECT a.id::text, u.usuario, a.accion, a.entidad, a.entidad_id, a.ocurrido_en, a.detalle
         FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
        WHERE $1::text IS NULL OR a.entidad = $1
        ORDER BY a.id DESC LIMIT $2 OFFSET $3`, [entidad, limite, desplazamiento]);
    return {
      items: filas.map((f) => ({ ...f, id: Number(f.id), ocurrido_en: aBogota(new Date(f.ocurrido_en)) })),
      total,
    };
  });
}
