// Lavandería (TICKET-23; FR-27, RN-22). Huésped: el pedido se carga a su cuenta y se entrega cobrando o, sin pago,
// con la autorización registrada de quien entrega (la deuda sigue en la cuenta; nadie sale debiendo, RN-07).
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar, auditarVarios } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { publicarEventos, type Evento } from '../comun/eventos.ts';
import { turnoAbiertoId } from '../caja/turnos.ts';
import { estadiaActiva } from '../estadias/cargos.ts';
import { leerEstadia } from '../estadias/estadias.ts';

type Medio = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA';
interface FilaPedido {
  id: string; estadia_id: string | null; habitacion_numero: string | null; cliente_nombre: string | null; detalle: string; total: number; estado: string;
  registrado_por: string; registrado_en: Date; entregado_por: string | null; entregado_en: Date | null; sin_pago_autorizado_por: string | null;
}

const ITEMS = {
  type: 'array', minItems: 1, maxItems: 20,
  items: {
    type: 'object', additionalProperties: false, required: ['producto_id', 'cantidad'],
    properties: { producto_id: { type: 'string', format: 'uuid' }, cantidad: { type: 'integer', minimum: 1, maximum: 50 } },
  },
};
const ID = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } };

export async function leerPedidos(bd: Bd, filtro: { id?: string; estado?: string }) {
  const filas = await bd.consultar<FilaPedido>(
    `SELECT p.id, p.estadia_id, e.habitacion_numero, p.cliente_nombre,
            (SELECT string_agg(i.concepto || ' × ' || i.cantidad, ', ' ORDER BY i.orden) FROM pedidos_lavanderia_items i WHERE i.pedido_id = p.id) AS detalle,
            p.total, p.estado, r.usuario AS registrado_por, p.registrado_en, ent.usuario AS entregado_por, p.entregado_en,
            aut.usuario AS sin_pago_autorizado_por
       FROM pedidos_lavanderia p LEFT JOIN estadias e ON e.id = p.estadia_id JOIN usuarios r ON r.id = p.registrado_por
       LEFT JOIN usuarios ent ON ent.id = p.entregado_por LEFT JOIN usuarios aut ON aut.id = p.sin_pago_autorizado_por
      WHERE ($1::uuid IS NULL OR p.id = $1) AND ($2::text IS NULL OR p.estado = $2)
      ORDER BY p.registrado_en, p.id`, [filtro.id ?? null, filtro.estado ?? null]);
  return filas.map((f) => ({ ...f, registrado_en: aBogota(new Date(f.registrado_en)), entregado_en: f.entregado_en ? aBogota(new Date(f.entregado_en)) : null }));
}

/** Prendas pedidas con su precio vigente (lo pone el servidor). Solo productos activos del grupo Lavandería. */
async function prendas(tx: Bd, items: Array<{ producto_id: string; cantidad: number }>) {
  const productos = new Map((await tx.consultar<{ id: string; nombre: string; grupo: string; precio: number; activo: boolean }>(
    'SELECT id, nombre, grupo, precio, activo FROM productos WHERE id = ANY($1::uuid[])', [items.map((i) => i.producto_id)],
  )).map((p) => [p.id, p]));
  return items.map((item, i) => {
    const p = productos.get(item.producto_id);
    if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Esa prenda no existe en el catálogo.');
    if (!p.activo) throw new ErrorApi(409, 'CONFLICTO', `«${p.nombre}» ya no está en el catálogo.`);
    if (p.grupo !== 'LAVANDERIA') throw new ErrorApi(422, 'NO_VENDIBLE', `«${p.nombre}» no es una prenda de lavandería.`);
    return { orden: i + 1, p, cantidad: item.cantidad, valor: p.precio * item.cantidad };
  });
}

/** Cobra lo que falta del pedido (sin pasar del saldo de la cuenta) y devuelve el evento, si hay uno. */
async function cobrar(tx: Bd, e: { estadiaId: string; habitacion: string; valor: number; medio: Medio; usuarioId: string; momento: Date }): Promise<Evento | null> {
  const turnoId = await turnoAbiertoId(tx);
  const efectivo = e.medio === 'EFECTIVO';
  const [p] = await tx.consultar<{ id: string }>(
    `INSERT INTO pagos (estadia_id, turno_id, medio, valor, estado, registrado_por, registrado_en) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [e.estadiaId, turnoId, e.medio, e.valor, efectivo ? 'EN_CAJA' : 'POR_VERIFICAR', e.usuarioId, e.momento]);
  await auditar(tx, { usuarioId: e.usuarioId, accion: 'CREAR', entidad: 'pagos', entidadId: p.id, detalle: { medio: e.medio, valor: String(e.valor) }, ocurrido: e.momento });
  return efectivo ? null : ['pago.por_verificar', { entidad_id: p.id, habitacion_numero: e.habitacion, valor: e.valor }];
}

export function rutasLavanderia(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const turno = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);

  app.post<{ Params: { id: string }; Body: { items: Array<{ producto_id: string; cantidad: number }> } }>('/estadias/:id/lavanderia', {
    preHandler: turno,
    schema: { params: ID, body: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: ITEMS } } },
  }, async (req, rep) => {
    const u = req.usuario!;
    const pedidoId = await bd.transaccion(async (tx) => {
      const momento = ahora();
      const est = await estadiaActiva(tx, req.params.id);
      const turnoId = await turnoAbiertoId(tx);
      const filas = await prendas(tx, req.body.items);
      const total = filas.reduce((s, f) => s + f.valor, 0);
      if (total <= 0) throw new ErrorApi(422, 'NO_VENDIBLE', 'El pedido tiene que tener un valor mayor que $0.');
      const [p] = await tx.consultar<{ id: string }>(
        `INSERT INTO pedidos_lavanderia (estadia_id, turno_id, total, registrado_por, registrado_en) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [req.params.id, turnoId, total, u.id, momento]);
      const columnas = [filas.map((f) => f.orden), filas.map((f) => f.p.id), filas.map((f) => f.p.nombre), filas.map((f) => f.cantidad),
        filas.map((f) => f.p.precio), filas.map((f) => f.valor)];
      await tx.consultar(
        `INSERT INTO pedidos_lavanderia_items (pedido_id, orden, producto_id, concepto, cantidad, valor_unitario, valor)
         SELECT $1, i.* FROM unnest($2::int[], $3::uuid[], $4::text[], $5::int[], $6::int[], $7::int[]) AS i`, [p.id, ...columnas]);
      // El lavado se carga a la cuenta de la habitación (T4-3), un cargo por prenda, unido al pedido.
      await tx.consultar(
        `INSERT INTO cargos (estadia_id, producto_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en, pedido_lavanderia_id)
         SELECT $1, i.producto_id, 'PRODUCTO', 'Lavandería: ' || i.concepto, i.cantidad, i.valor_unitario, i.valor, $2, $3, $4
           FROM unnest($5::int[], $6::uuid[], $7::text[], $8::int[], $9::int[], $10::int[]) AS i(orden, producto_id, concepto, cantidad, valor_unitario, valor)
          ORDER BY i.orden`, [req.params.id, u.id, momento, p.id, ...columnas]);
      await auditarVarios(tx, [{ usuarioId: u.id, accion: 'CREAR', entidad: 'pedidos_lavanderia', entidadId: p.id, detalle: { total: String(total) }, ocurrido: momento }]);
      await publicarEventos(tx, [['habitacion.actualizada', { numero: est.habitacion_numero, entidad_id: req.params.id }]], momento);
      return p.id;
    });
    const [pedido] = await leerPedidos(bd, { id: pedidoId });
    return rep.code(201).send(pedido);
  });

  app.get<{ Querystring: { estado?: string } }>('/lavanderia', {
    preHandler: turno,
    schema: { querystring: { type: 'object', additionalProperties: false, properties: { estado: { type: 'string', enum: ['RECIBIDO', 'ENTREGADO'] } } } },
  }, async (req) => ({ items: await leerPedidos(bd, { estado: req.query.estado }) }));

  app.post<{ Params: { id: string }; Body: { cobro?: { medio: Medio }; sin_pago_autorizado?: boolean } }>('/lavanderia/:id/entrega', {
    preHandler: turno,
    schema: {
      params: ID,
      body: {
        type: 'object', additionalProperties: false,
        properties: {
          cobro: { type: 'object', additionalProperties: false, required: ['medio'], properties: { medio: { type: 'string', enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'] } } },
          sin_pago_autorizado: { type: 'boolean' },
        },
      },
    },
  }, async (req) => {
    const u = req.usuario!;
    await bd.transaccion(async (tx) => {
      const momento = ahora();
      const [p] = await tx.consultar<{ estado: string; estadia_id: string | null; total: number }>(
        'SELECT estado, estadia_id, total FROM pedidos_lavanderia WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El pedido de lavandería no existe.');
      if (p.estado !== 'RECIBIDO') throw new ErrorApi(409, 'CONFLICTO', 'Ese pedido ya se entregó.');
      const est = (await leerEstadia(tx, p.estadia_id!))!;
      // Lo que falta del pedido: su valor, sin pasar del saldo (si pagó antes, no se cobra de nuevo).
      const falta = Math.min(p.total, Math.max(0, est.cuenta.saldo));
      const eventos: Evento[] = [['habitacion.actualizada', { numero: est.habitacion_numero, entidad_id: p.estadia_id }]];
      let sinPago = false;
      if (falta > 0 && req.body.cobro) {
        const ev = await cobrar(tx, { estadiaId: p.estadia_id!, habitacion: est.habitacion_numero, valor: falta, medio: req.body.cobro.medio, usuarioId: u.id, momento });
        if (ev) eventos.push(ev);
      } else if (falta > 0 && req.body.sin_pago_autorizado) {
        sinPago = true;
      } else if (falta > 0) {
        throw new ErrorApi(422, 'PAGO_REQUERIDO', 'Cobre el lavado antes de entregar la ropa, o marque que usted autoriza entregarla sin pago.');
      }
      await tx.consultar(
        `UPDATE pedidos_lavanderia SET estado = 'ENTREGADO', entregado_por = $2, entregado_en = $3, sin_pago_autorizado_por = $4 WHERE id = $1`,
        [req.params.id, u.id, momento, sinPago ? u.id : null]);
      const detalle: Record<string, string> = { estado: 'ENTREGADO' };
      if (sinPago) detalle.sin_pago = 'autorizado';
      if (falta > 0 && req.body.cobro) detalle.cobro = req.body.cobro.medio;
      await auditar(tx, { usuarioId: u.id, accion: 'ACTUALIZAR', entidad: 'pedidos_lavanderia', entidadId: req.params.id, detalle, ocurrido: momento });
      await publicarEventos(tx, eventos, momento);
    });
    const [pedido] = await leerPedidos(bd, { id: req.params.id });
    return pedido;
  });
}
