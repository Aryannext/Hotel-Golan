// Informe de productos vendidos (TICKET-35; FR-32, RN-15, RN-21): qué se vendió, por turno, por día del hotel (6:30 a
// 6:30) o por un rango de días (semana o mes), sin contar productos en el turno (administradora, HG-ACT-001 V5-20).
// Cuenta los cargos de producto vigentes (incluida la lavandería de huéspedes), las ventas de contado cuyo pago no se
// anuló y la lavandería de personas de afuera. Los importes son los del registro (el precio de ese momento, RN-19).
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { ErrorApi } from '../comun/errores.ts';

const DIA_MS = 86_400_000;
const ORDEN_GRUPOS = ['NEVERA', 'VITRINA_PASABOCAS', 'VITRINA_ASEO', 'LAVANDERIA', 'OTROS'];
interface Fila { grupo: string; nombre: string; cantidad: number; valor: number }
interface Consulta { desde?: string; hasta?: string; turno_id?: string }

/** Inicio y fin del periodo: días del hotel de 6:30 a 6:30 (RN-15), o el periodo del turno (si sigue abierto, hasta ahora). */
async function periodo(bd: Bd, q: Consulta, ahora: Date): Promise<{ ini: Date; fin: Date }> {
  if (q.turno_id) {
    const [t] = await bd.consultar<{ inicio_en: Date; fin_en: Date | null }>('SELECT inicio_en, fin_en FROM turnos WHERE id = $1', [q.turno_id]);
    if (!t) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Ese turno no existe.');
    // Abierto: todo lo registrado hasta ahora, incluido lo de este mismo instante.
    return { ini: new Date(t.inicio_en), fin: t.fin_en ? new Date(t.fin_en) : new Date(ahora.getTime() + 1) };
  }
  if (!q.desde || !q.hasta) throw new ErrorApi(400, 'INVALID_PAYLOAD', 'Indique un turno o un rango de días (desde y hasta).');
  if (q.desde > q.hasta) throw new ErrorApi(400, 'INVALID_PAYLOAD', 'La fecha inicial debe ser anterior o igual a la final.');
  return { ini: new Date(`${q.desde}T06:30:00-05:00`), fin: new Date(new Date(`${q.hasta}T06:30:00-05:00`).getTime() + DIA_MS) };
}

export function rutasProductosVendidos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get<{ Querystring: Consulta }>('/reportes/productos', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { querystring: {
      type: 'object', additionalProperties: false,
      properties: { desde: { type: 'string', format: 'date' }, hasta: { type: 'string', format: 'date' }, turno_id: { type: 'string', format: 'uuid' } },
    } },
  }, async (req) => {
    const { ini, fin } = await periodo(bd, req.query, ahora());
    const filas = await bd.consultar<Fila>(
      `WITH vendido AS (
         SELECT c.producto_id, c.cantidad, c.valor, c.creado_en AS momento
           FROM cargos c WHERE c.tipo = 'PRODUCTO' AND c.anulado_en IS NULL AND c.producto_id IS NOT NULL
         UNION ALL
         SELECT i.producto_id, i.cantidad, i.valor, v.registrado_en
           FROM ventas_items i JOIN ventas v ON v.id = i.venta_id
          WHERE EXISTS (SELECT 1 FROM pagos p WHERE p.venta_id = v.id AND p.anulado_en IS NULL)
         UNION ALL
         SELECT i.producto_id, i.cantidad, i.valor, p.registrado_en
           FROM pedidos_lavanderia_items i JOIN pedidos_lavanderia p ON p.id = i.pedido_id
          WHERE p.cliente_nombre IS NOT NULL
       )
       SELECT pr.grupo, pr.nombre, sum(x.cantidad)::int AS cantidad, sum(x.valor)::int AS valor
         FROM vendido x JOIN productos pr ON pr.id = x.producto_id
        WHERE x.momento >= $1 AND x.momento < $2
        GROUP BY pr.grupo, pr.nombre
        ORDER BY pr.nombre`, [ini, fin]);
    const grupos = ORDEN_GRUPOS.map((grupo) => {
      const productos = filas.filter((f) => f.grupo === grupo).map(({ nombre, cantidad, valor }) => ({ nombre, cantidad, valor }));
      return { grupo, productos, cantidad: productos.reduce((s, p) => s + p.cantidad, 0), valor: productos.reduce((s, p) => s + p.valor, 0) };
    }).filter((g) => g.productos.length > 0);
    return {
      desde: req.query.desde ?? null, hasta: req.query.hasta ?? null, turno_id: req.query.turno_id ?? null, grupos,
      cantidad: grupos.reduce((s, g) => s + g.cantidad, 0), valor: grupos.reduce((s, g) => s + g.valor, 0),
    };
  });
}
