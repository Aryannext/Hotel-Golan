// Lavandería (TICKET-23 y TICKET-24; FR-27, RN-22).
// Huésped: el pedido se carga a su cuenta y se entrega cobrando lo que falte (sin pasar del saldo).
// Externo (solo su nombre, T4-4): paga por adelantado o al reclamar; sus pagos quedan en el pedido.
// En los dos casos, sin pago solo se entrega con la autorización registrada de quien entrega, y la deuda sigue.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { publicarEventos, type Evento } from '../comun/eventos.ts';
import { turnoAbiertoId } from '../caja/turnos.ts';
import { estadiaActiva } from '../estadias/cargos.ts';
import { leerEstadia } from '../estadias/estadias.ts';

type Medio = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA';
type Items = Array<{ producto_id: string; cantidad: number }>;
interface FilaPedido {
  id: string; estadia_id: string | null; habitacion_numero: string | null; cliente_nombre: string | null; detalle: string; total: number; estado: string;
  por_cobrar: number | null; registrado_por: string; registrado_en: Date; entregado_por: string | null; entregado_en: Date | null; sin_pago_autorizado_por: string | null;
}

const ITEMS = {
  type: 'array', minItems: 1, maxItems: 20,
  items: {
    type: 'object', additionalProperties: false, required: ['producto_id', 'cantidad'],
    properties: { producto_id: { type: 'string', format: 'uuid' }, cantidad: { type: 'integer', minimum: 1, maximum: 50 } },
  },
};
const COBRO = { type: 'object', additionalProperties: false, required: ['medio'], properties: { medio: { type: 'string', enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'] } } };
const ID = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } };

/** Lo que le falta pagar a un externo: total menos sus pagos vigentes (una transferencia por verificar cuenta como pagada). */
const POR_COBRAR = `CASE WHEN p.cliente_nombre IS NULL THEN NULL ELSE p.total - coalesce((
  SELECT sum(g.valor) FROM pagos g WHERE g.pedido_lavanderia_id = p.id AND g.anulado_en IS NULL AND g.estado <> 'RECHAZADO'), 0)::int END`;

export async function leerPedidos(bd: Bd, filtro: { id?: string; estado?: string; deudas?: boolean }) {
  const filas = await bd.consultar<FilaPedido>(
    `SELECT * FROM (
       SELECT p.id, p.estadia_id, e.habitacion_numero, p.cliente_nombre,
              (SELECT string_agg(i.concepto || ' × ' || i.cantidad, ', ' ORDER BY i.orden) FROM pedidos_lavanderia_items i WHERE i.pedido_id = p.id) AS detalle,
              p.total, p.estado, ${POR_COBRAR} AS por_cobrar, r.usuario AS registrado_por, p.registrado_en,
              ent.usuario AS entregado_por, p.entregado_en, aut.usuario AS sin_pago_autorizado_por
         FROM pedidos_lavanderia p LEFT JOIN estadias e ON e.id = p.estadia_id JOIN usuarios r ON r.id = p.registrado_por
         LEFT JOIN usuarios ent ON ent.id = p.entregado_por LEFT JOIN usuarios aut ON aut.id = p.sin_pago_autorizado_por
        WHERE ($1::uuid IS NULL OR p.id = $1) AND ($2::text IS NULL OR p.estado = $2)
     ) x
     WHERE NOT $3::boolean OR (x.estado = 'ENTREGADO' AND x.por_cobrar > 0)
     ORDER BY x.registrado_en, x.id`, [filtro.id ?? null, filtro.estado ?? null, !!filtro.deudas]);
  return filas.map((f) => ({ ...f, registrado_en: aBogota(new Date(f.registrado_en)), entregado_en: f.entregado_en ? aBogota(new Date(f.entregado_en)) : null }));
}

/** Prendas pedidas con su precio vigente (lo pone el servidor). Solo productos activos del grupo Lavandería. */
async function prendas(tx: Bd, items: Items) {
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

/** Crea el pedido con sus prendas y devuelve su id, el total y las columnas de las prendas (para los cargos). */
async function crearPedido(tx: Bd, d: { estadiaId: string | null; cliente: string | null; items: Items; usuarioId: string; momento: Date }) {
  const turnoId = await turnoAbiertoId(tx);
  const filas = await prendas(tx, d.items);
  const total = filas.reduce((s, f) => s + f.valor, 0);
  if (total <= 0) throw new ErrorApi(422, 'NO_VENDIBLE', 'El pedido tiene que tener un valor mayor que $0.');
  const [p] = await tx.consultar<{ id: string }>(
    `INSERT INTO pedidos_lavanderia (estadia_id, cliente_nombre, turno_id, total, registrado_por, registrado_en) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [d.estadiaId, d.cliente, turnoId, total, d.usuarioId, d.momento]);
  const columnas = [filas.map((f) => f.orden), filas.map((f) => f.p.id), filas.map((f) => f.p.nombre), filas.map((f) => f.cantidad),
    filas.map((f) => f.p.precio), filas.map((f) => f.valor)];
  await tx.consultar(
    `INSERT INTO pedidos_lavanderia_items (pedido_id, orden, producto_id, concepto, cantidad, valor_unitario, valor)
     SELECT $1, i.* FROM unnest($2::int[], $3::uuid[], $4::text[], $5::int[], $6::int[], $7::int[]) AS i`, [p.id, ...columnas]);
  await auditar(tx, { usuarioId: d.usuarioId, accion: 'CREAR', entidad: 'pedidos_lavanderia', entidadId: p.id, detalle: { total: String(total) }, ocurrido: d.momento });
  return { id: p.id, total, columnas };
}

/** Registra un pago de `valor` para la cuenta de una estadía o para el pedido de un externo; devuelve el evento de la transferencia. */
async function cobrar(tx: Bd, e: { estadiaId: string | null; pedidoId: string | null; habitacion: string | null; valor: number; medio: Medio; usuarioId: string; momento: Date }): Promise<Evento | null> {
  const turnoId = await turnoAbiertoId(tx);
  const efectivo = e.medio === 'EFECTIVO';
  const [p] = await tx.consultar<{ id: string }>(
    `INSERT INTO pagos (estadia_id, pedido_lavanderia_id, turno_id, medio, valor, estado, registrado_por, registrado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [e.estadiaId, e.pedidoId, turnoId, e.medio, e.valor, efectivo ? 'EN_CAJA' : 'POR_VERIFICAR', e.usuarioId, e.momento]);
  await auditar(tx, { usuarioId: e.usuarioId, accion: 'CREAR', entidad: 'pagos', entidadId: p.id, detalle: { medio: e.medio, valor: String(e.valor) }, ocurrido: e.momento });
  return efectivo ? ['caja.movimiento', { entidad_id: p.id, valor: e.valor, habitacion_numero: e.habitacion }] : ['pago.por_verificar', { entidad_id: p.id, habitacion_numero: e.habitacion, valor: e.valor }];
}

/** Lo que falta pagar del pedido: huésped, su valor sin pasar del saldo de la cuenta; externo, total menos sus pagos. */
async function faltaDe(tx: Bd, p: { id: string; estadia_id: string | null; total: number }) {
  if (p.estadia_id) {
    const est = (await leerEstadia(tx, p.estadia_id))!;
    return { falta: Math.min(p.total, Math.max(0, est.cuenta.saldo)), habitacion: est.habitacion_numero as string | null };
  }
  const [x] = await leerPedidos(tx, { id: p.id });
  return { falta: x.por_cobrar ?? 0, habitacion: null };
}

export function rutasLavanderia(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const turno = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);

  app.post<{ Params: { id: string }; Body: { items: Items } }>('/estadias/:id/lavanderia', {
    preHandler: turno,
    schema: { params: ID, body: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: ITEMS } } },
  }, async (req, rep) => {
    const u = req.usuario!;
    const pedidoId = await bd.transaccion(async (tx) => {
      const momento = ahora();
      const est = await estadiaActiva(tx, req.params.id);
      const p = await crearPedido(tx, { estadiaId: req.params.id, cliente: null, items: req.body.items, usuarioId: u.id, momento });
      // El lavado se carga a la cuenta de la habitación (T4-3), un cargo por prenda, unido al pedido.
      await tx.consultar(
        `INSERT INTO cargos (estadia_id, producto_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en, pedido_lavanderia_id)
         SELECT $1, i.producto_id, 'PRODUCTO', 'Lavandería: ' || i.concepto, i.cantidad, i.valor_unitario, i.valor, $2, $3, $4
           FROM unnest($5::int[], $6::uuid[], $7::text[], $8::int[], $9::int[], $10::int[]) AS i(orden, producto_id, concepto, cantidad, valor_unitario, valor)
          ORDER BY i.orden`, [req.params.id, u.id, momento, p.id, ...p.columnas]);
      await publicarEventos(tx, [['habitacion.actualizada', { numero: est.habitacion_numero, entidad_id: req.params.id }]], momento);
      return p.id;
    });
    const [pedido] = await leerPedidos(bd, { id: pedidoId });
    return rep.code(201).send(pedido);
  });

  // Externo: solo su nombre (T4-4). Puede pagar de una vez (`cobro`) o al reclamar.
  app.post<{ Body: { cliente_nombre: string; items: Items; cobro?: { medio: Medio } } }>('/lavanderia', {
    preHandler: turno,
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['cliente_nombre', 'items'],
        properties: { cliente_nombre: { type: 'string', minLength: 2, maxLength: 120, pattern: '\\S.*\\S' }, items: ITEMS, cobro: COBRO },
      },
    },
  }, async (req, rep) => {
    const u = req.usuario!;
    const pedidoId = await bd.transaccion(async (tx) => {
      const momento = ahora();
      const p = await crearPedido(tx, { estadiaId: null, cliente: req.body.cliente_nombre.trim(), items: req.body.items, usuarioId: u.id, momento });
      if (req.body.cobro) {
        const ev = await cobrar(tx, { estadiaId: null, pedidoId: p.id, habitacion: null, valor: p.total, medio: req.body.cobro.medio, usuarioId: u.id, momento });
        if (ev) await publicarEventos(tx, [ev], momento);
      }
      return p.id;
    });
    const [pedido] = await leerPedidos(bd, { id: pedidoId });
    return rep.code(201).send(pedido);
  });

  app.get<{ Querystring: { estado?: string } }>('/lavanderia', {
    preHandler: turno,
    schema: { querystring: { type: 'object', additionalProperties: false, properties: { estado: { type: 'string', enum: ['RECIBIDO', 'ENTREGADO'] } } } },
  }, async (req) => ({ items: await leerPedidos(bd, { estado: req.query.estado }) }));

  // Deudas de externos: entregado sin pagar todo (con la autorización de quien entregó).
  app.get('/lavanderia/deudas', { preHandler: turno }, async () => ({ items: await leerPedidos(bd, { deudas: true }) }));

  app.post<{ Params: { id: string }; Body: { medio: Medio } }>('/lavanderia/:id/cobro', {
    preHandler: turno, schema: { params: ID, body: COBRO },
  }, async (req) => {
    const u = req.usuario!;
    await bd.transaccion(async (tx) => {
      const momento = ahora();
      const [p] = await tx.consultar<{ id: string; estadia_id: string | null; total: number }>(
        'SELECT id, estadia_id, total FROM pedidos_lavanderia WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El pedido de lavandería no existe.');
      if (p.estadia_id) throw new ErrorApi(409, 'CONFLICTO', 'El lavado de un huésped se cobra en la cuenta de su habitación.');
      const { falta } = await faltaDe(tx, p);
      if (falta <= 0) throw new ErrorApi(409, 'CONFLICTO', 'Ese pedido ya está pagado.');
      const ev = await cobrar(tx, { estadiaId: null, pedidoId: p.id, habitacion: null, valor: falta, medio: req.body.medio, usuarioId: u.id, momento });
      if (ev) await publicarEventos(tx, [ev], momento);
    });
    const [pedido] = await leerPedidos(bd, { id: req.params.id });
    return pedido;
  });

  app.post<{ Params: { id: string }; Body: { cobro?: { medio: Medio }; sin_pago_autorizado?: boolean } }>('/lavanderia/:id/entrega', {
    preHandler: turno,
    schema: { params: ID, body: { type: 'object', additionalProperties: false, properties: { cobro: COBRO, sin_pago_autorizado: { type: 'boolean' } } } },
  }, async (req) => {
    const u = req.usuario!;
    await bd.transaccion(async (tx) => {
      const momento = ahora();
      const [p] = await tx.consultar<{ id: string; estado: string; estadia_id: string | null; total: number }>(
        'SELECT id, estado, estadia_id, total FROM pedidos_lavanderia WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El pedido de lavandería no existe.');
      if (p.estado !== 'RECIBIDO') throw new ErrorApi(409, 'CONFLICTO', 'Ese pedido ya se entregó.');
      const { falta, habitacion } = await faltaDe(tx, p);
      const eventos: Evento[] = p.estadia_id ? [['habitacion.actualizada', { numero: habitacion, entidad_id: p.estadia_id }]] : [];
      const cobra = falta > 0 && !!req.body.cobro;
      const sinPago = falta > 0 && !cobra && !!req.body.sin_pago_autorizado;
      if (falta > 0 && !cobra && !sinPago) {
        throw new ErrorApi(422, 'PAGO_REQUERIDO', 'Cobre el lavado antes de entregar la ropa, o marque que usted autoriza entregarla sin pago.');
      }
      if (cobra) {
        const ev = await cobrar(tx, { estadiaId: p.estadia_id, pedidoId: p.estadia_id ? null : p.id, habitacion, valor: falta, medio: req.body.cobro!.medio, usuarioId: u.id, momento });
        if (ev) eventos.push(ev);
      }
      await tx.consultar(
        `UPDATE pedidos_lavanderia SET estado = 'ENTREGADO', entregado_por = $2, entregado_en = $3, sin_pago_autorizado_por = $4 WHERE id = $1`,
        [req.params.id, u.id, momento, sinPago ? u.id : null]);
      const detalle: Record<string, string> = { estado: 'ENTREGADO' };
      if (sinPago) detalle.sin_pago = 'autorizado';
      if (cobra) detalle.cobro = req.body.cobro!.medio;
      await auditar(tx, { usuarioId: u.id, accion: 'ACTUALIZAR', entidad: 'pedidos_lavanderia', entidadId: req.params.id, detalle, ocurrido: momento });
      await publicarEventos(tx, eventos, momento);
    });
    const [pedido] = await leerPedidos(bd, { id: req.params.id });
    return pedido;
  });
}
