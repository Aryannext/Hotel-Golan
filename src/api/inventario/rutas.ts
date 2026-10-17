// Surtido y existencias de vitrina y nevera (TICKET-21; FR-25, RN-21). Solo la administración.
// Existencias calculadas (T4-12): lo que llegó menos lo vendido, sin conteo manual en el relevo.
// Con 0 o menos se avisa en la PWA, pero la venta no se bloquea [P].
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';

/** Grupos que se cuentan; lavandería, llave y recargos no tienen existencias. */
export const GRUPOS_CON_EXISTENCIAS = ['NEVERA', 'VITRINA_PASABOCAS', 'VITRINA_ASEO'];

/** Unidades vendidas por producto: cargos de producto vigentes y ventas de contado cuyo pago no está anulado (TICKET-22). */
const VENDIDO = `SELECT producto_id, sum(cantidad)::int AS total FROM (
                   SELECT producto_id, cantidad FROM cargos WHERE anulado_en IS NULL AND producto_id IS NOT NULL
                   UNION ALL
                   SELECT vi.producto_id, vi.cantidad FROM ventas_items vi JOIN pagos p ON p.venta_id = vi.venta_id WHERE p.anulado_en IS NULL
                 ) vendido GROUP BY producto_id`;

export function rutasInventario(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const soloAdministracion = requiere(bd, ahora, ['ADMINISTRACION']);

  app.post<{ Body: { producto_id: string; cantidad: number } }>('/surtidos', {
    preHandler: soloAdministracion,
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['producto_id', 'cantidad'],
        properties: { producto_id: { type: 'string', format: 'uuid' }, cantidad: { type: 'integer', minimum: 1, maximum: 10000 } },
      },
    },
  }, async (req, rep) => {
    const momento = ahora();
    const fila = await bd.transaccion(async (tx) => {
      const [p] = await tx.consultar<{ grupo: string; nombre: string }>('SELECT grupo, nombre FROM productos WHERE id = $1', [req.body.producto_id]);
      if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El producto no existe.');
      if (!GRUPOS_CON_EXISTENCIAS.includes(p.grupo)) {
        throw new ErrorApi(422, 'SIN_EXISTENCIAS', `«${p.nombre}» no lleva existencias: solo la nevera y las vitrinas.`);
      }
      const [s] = await tx.consultar<{ id: string; producto_id: string; cantidad: number; registrado_en: Date }>(
        `INSERT INTO surtidos (producto_id, cantidad, registrado_por, registrado_en) VALUES ($1, $2, $3, $4)
         RETURNING id, producto_id, cantidad, registrado_en`, [req.body.producto_id, req.body.cantidad, req.usuario!.id, momento]);
      await auditar(tx, {
        usuarioId: req.usuario!.id, accion: 'CREAR', entidad: 'surtidos', entidadId: s.id, detalle: { cantidad: String(req.body.cantidad) }, ocurrido: momento,
      });
      return { ...s, registrado_en: aBogota(new Date(s.registrado_en)) };
    });
    return rep.code(201).send(fila);
  });

  app.get('/existencias', { preHandler: soloAdministracion }, async () => ({
    items: await bd.consultar(
      `SELECT p.id AS producto_id, p.nombre, p.grupo, p.precio,
              coalesce(s.total, 0) AS surtido, coalesce(v.total, 0) AS vendido, coalesce(s.total, 0) - coalesce(v.total, 0) AS existencias
         FROM productos p
         LEFT JOIN (SELECT producto_id, sum(cantidad)::int AS total FROM surtidos WHERE anulado_en IS NULL GROUP BY producto_id) s ON s.producto_id = p.id
         LEFT JOIN (${VENDIDO}) v ON v.producto_id = p.id
        WHERE p.activo AND p.grupo = ANY($1::text[])
        ORDER BY p.grupo, p.nombre`, [GRUPOS_CON_EXISTENCIAS]),
  }));
}
