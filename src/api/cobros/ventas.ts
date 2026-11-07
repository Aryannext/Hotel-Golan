// Venta de contado (TICKET-22; FR-26, RN-20): productos de la nevera y las vitrinas, sin habitación.
// El pago va a `pagos` con `venta_id`: el efectivo entra a la caja del turno (RN-10) y la transferencia queda
// «por verificar» (RN-12). Para anularla se anula su pago (POST /pagos/{id}/anulacion, solo la administración).
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditarVarios } from '../comun/auditoria.ts';
import { ErrorApi } from '../comun/errores.ts';
import { conIdempotencia } from '../comun/idempotencia.ts';
import { publicarEventos, type Evento } from '../comun/eventos.ts';
import { turnoAbiertoId } from '../caja/abierto.ts';
import { GRUPOS_CON_EXISTENCIAS } from '../inventario/rutas.ts';
import { leerPagos } from './pagos.ts';

type Medio = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA';
interface Cuerpo { items: Array<{ producto_id: string; cantidad: number }>; medio: Medio }
interface FilaProducto { id: string; nombre: string; grupo: string; precio: number; activo: boolean }

/** Productos pedidos, validados y con su precio vigente (el precio lo pone el servidor, no la pantalla). */
async function renglones(tx: Bd, items: Cuerpo['items']) {
  const productos = new Map((await tx.consultar<FilaProducto>(
    'SELECT id, nombre, grupo, precio, activo FROM productos WHERE id = ANY($1::uuid[])', [items.map((i) => i.producto_id)],
  )).map((p) => [p.id, p]));
  return items.map((item, i) => {
    const p = productos.get(item.producto_id);
    if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Ese producto no existe en el catálogo.');
    if (!p.activo) throw new ErrorApi(409, 'CONFLICTO', `«${p.nombre}» ya no está a la venta.`);
    if (!GRUPOS_CON_EXISTENCIAS.includes(p.grupo)) {
      throw new ErrorApi(422, 'NO_VENDIBLE', `«${p.nombre}» no se vende de contado: solo productos de la nevera y las vitrinas.`);
    }
    return { orden: i + 1, p, cantidad: item.cantidad, valor: p.precio * item.cantidad };
  });
}

const ESQUEMA = {
  headers: { type: 'object', properties: { 'idempotency-key': { type: 'string', format: 'uuid' } } },
  body: {
    type: 'object', additionalProperties: false, required: ['items', 'medio'],
    properties: {
      items: {
        type: 'array', minItems: 1, maxItems: 20,
        items: {
          type: 'object', additionalProperties: false, required: ['producto_id', 'cantidad'],
          properties: { producto_id: { type: 'string', format: 'uuid' }, cantidad: { type: 'integer', minimum: 1, maximum: 50 } },
        },
      },
      medio: { type: 'string', enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'] },
    },
  },
};

export function rutasVentas(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.post<{ Body: Cuerpo; Headers: { 'idempotency-key'?: string } }>('/ventas', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']), schema: ESQUEMA,
  }, async (req, rep) => {
    const u = req.usuario!;
    const r = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'venderContado', async (tx) => {
      const momento = ahora();
      const turnoId = await turnoAbiertoId(tx);
      const filas = await renglones(tx, req.body.items);
      const total = filas.reduce((s, f) => s + f.valor, 0);
      if (total <= 0) throw new ErrorApi(422, 'NO_VENDIBLE', 'La venta tiene que tener un valor mayor que $0.');
      const [venta] = await tx.consultar<{ id: string }>(
        'INSERT INTO ventas (turno_id, total, registrado_por, registrado_en) VALUES ($1, $2, $3, $4) RETURNING id', [turnoId, total, u.id, momento]);
      await tx.consultar(
        `INSERT INTO ventas_items (venta_id, orden, producto_id, concepto, cantidad, valor_unitario, valor)
         SELECT $1, i.orden, i.producto_id, i.concepto, i.cantidad, i.valor_unitario, i.valor
           FROM unnest($2::int[], $3::uuid[], $4::text[], $5::int[], $6::int[], $7::int[]) AS i(orden, producto_id, concepto, cantidad, valor_unitario, valor)`,
        [venta.id, filas.map((f) => f.orden), filas.map((f) => f.p.id), filas.map((f) => f.p.nombre), filas.map((f) => f.cantidad),
          filas.map((f) => f.p.precio), filas.map((f) => f.valor)]);
      const efectivo = req.body.medio === 'EFECTIVO';
      const [pago] = await tx.consultar<{ id: string }>(
        `INSERT INTO pagos (venta_id, turno_id, medio, valor, estado, registrado_por, registrado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [venta.id, turnoId, req.body.medio, total, efectivo ? 'EN_CAJA' : 'POR_VERIFICAR', u.id, momento]);
      await auditarVarios(tx, [
        { usuarioId: u.id, accion: 'CREAR', entidad: 'ventas', entidadId: venta.id, detalle: { total: String(total), medio: req.body.medio }, ocurrido: momento },
        { usuarioId: u.id, accion: 'CREAR', entidad: 'pagos', entidadId: pago.id, detalle: { medio: req.body.medio, valor: String(total) }, ocurrido: momento },
      ]);
      // Sin habitación: el efectivo mueve la caja; la transferencia avisa a la administración.
      const evento: Evento = efectivo
        ? ['caja.movimiento', { entidad_id: venta.id, valor: total, habitacion_numero: null }]
        : ['pago.por_verificar', { entidad_id: pago.id, habitacion_numero: null, valor: total }];
      await publicarEventos(tx, [evento], momento);
      const [p] = await leerPagos(tx, { id: pago.id });
      return {
        estado: 201,
        cuerpo: {
          id: venta.id, total, pago: p,
          items: filas.map((f) => ({ producto_id: f.p.id, concepto: f.p.nombre, cantidad: f.cantidad, valor_unitario: f.p.precio, valor: f.valor })),
        },
      };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });
}
