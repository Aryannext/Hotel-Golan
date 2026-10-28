// Cargos a la cuenta de la habitación (FR-06; RN-14, RN-18): productos del catálogo con cantidad.
// Cada cargo guarda el precio del momento: un cambio de precio posterior no lo altera.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditarVarios } from '../comun/auditoria.ts';
import { ErrorApi } from '../comun/errores.ts';
import { CABECERA_IDEMPOTENCIA, conIdempotencia, type ConClave } from '../comun/idempotencia.ts';
import { leerEstadia } from './estadias.ts';

interface Cuerpo { items: Array<{ producto_id: string; cantidad: number }> }

/** La llave perdida y el recargo de aseo tienen su propio tipo de cargo; lo demás es PRODUCTO. [P] */
export function tipoDeCargo(nombre: string): 'LLAVE' | 'RECARGO_ASEO' | 'PRODUCTO' {
  const n = nombre.toLowerCase();
  if (n.startsWith('llave')) return 'LLAVE';
  if (n.startsWith('recargo aseo')) return 'RECARGO_ASEO';
  return 'PRODUCTO';
}

/** La estadía debe existir (404) y estar activa (409). Bloquea la fila mientras dura la transacción. */
export async function estadiaActiva(tx: Bd, id: string): Promise<{ habitacion_numero: string }> {
  const [e] = await tx.consultar<{ estado: string; habitacion_numero: string }>(
    'SELECT estado, habitacion_numero FROM estadias WHERE id = $1 FOR UPDATE', [id]);
  if (!e) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La estadía no existe.');
  if (e.estado !== 'ACTIVA') throw new ErrorApi(409, 'CONFLICTO', 'La estadía ya terminó: no se le pueden agregar cargos ni pagos.');
  return e;
}

const PARAMS_ID = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } };

/** El mapa muestra el saldo: se avisa que la habitación cambió. */
const avisarMapa = (tx: Bd, numero: string, estadiaId: string, momento: Date) => tx.consultar(
  'INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)',
  ['habitacion.actualizada', JSON.stringify({ numero, entidad_id: estadiaId }), momento]);

export function rutasCargos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.post<{ Params: { id: string }; Body: Cuerpo; Headers: { 'idempotency-key'?: string } }>('/estadias/:id/cargos', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      params: PARAMS_ID,
      headers: { type: 'object', properties: { 'idempotency-key': { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object', additionalProperties: false, required: ['items'],
        properties: {
          items: {
            type: 'array', minItems: 1, maxItems: 20,
            items: {
              type: 'object', additionalProperties: false, required: ['producto_id', 'cantidad'],
              properties: { producto_id: { type: 'string', format: 'uuid' }, cantidad: { type: 'integer', minimum: 1, maximum: 20 } },
            },
          },
        },
      },
    },
  }, async (req, rep) => {
    const u = req.usuario!;
    const r = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'agregarCargos', async (tx) => {
      const momento = ahora();
      const est = await estadiaActiva(tx, req.params.id);
      const productos = new Map((await tx.consultar<{ id: string; nombre: string; grupo: string; precio: number; activo: boolean }>(
        'SELECT id, nombre, grupo, precio, activo FROM productos WHERE id = ANY($1::uuid[])', [req.body.items.map((i) => i.producto_id)],
      )).map((p) => [p.id, p]));
      const filas = req.body.items.map((item) => {
        const p = productos.get(item.producto_id);
        if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Ese producto no existe en el catálogo.');
        if (!p.activo) throw new ErrorApi(409, 'CONFLICTO', `«${p.nombre}» ya no está a la venta.`);
        // Las prendas se registran como pedido de lavandería, para seguir su entrega (TICKET-23).
        if (p.grupo === 'LAVANDERIA') throw new ErrorApi(409, 'CONFLICTO', `«${p.nombre}» es de lavandería: regístrelo como pedido de lavandería.`);
        return { p, tipo: tipoDeCargo(p.nombre), cantidad: item.cantidad, valor: p.precio * item.cantidad };
      });
      const creados = await tx.consultar<{ id: string }>(
        `INSERT INTO cargos (estadia_id, producto_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en)
         SELECT $1, c.producto_id, c.tipo, c.concepto, c.cantidad, c.valor_unitario, c.valor, $2, $3
           FROM unnest($4::uuid[], $5::text[], $6::text[], $7::int[], $8::int[], $9::int[]) WITH ORDINALITY
                AS c(producto_id, tipo, concepto, cantidad, valor_unitario, valor, n)
          ORDER BY c.n
         RETURNING id`,
        [req.params.id, u.id, momento, filas.map((f) => f.p.id), filas.map((f) => f.tipo), filas.map((f) => f.p.nombre),
          filas.map((f) => f.cantidad), filas.map((f) => f.p.precio), filas.map((f) => f.valor)]);
      await auditarVarios(tx, creados.map((c, i) => ({
        usuarioId: u.id, accion: 'CREAR' as const, entidad: 'cargos', entidadId: c.id,
        detalle: { estadia: req.params.id, tipo: filas[i].tipo, valor: String(filas[i].valor) }, ocurrido: momento,
      })));
      await avisarMapa(tx, est.habitacion_numero, req.params.id, momento);
      return { estado: 201, cuerpo: await leerEstadia(tx, req.params.id) };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });

  // Daños (TICKET-27; RN-18): valor de reposición «como nuevo» que pone solo la administración; recepción la llama (V5-06).
  app.post<{ Params: { id: string }; Body: { descripcion: string; valor: number }; Headers: ConClave }>('/estadias/:id/danos', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: {
      params: PARAMS_ID,
      headers: CABECERA_IDEMPOTENCIA,
      body: {
        type: 'object', additionalProperties: false, required: ['descripcion', 'valor'],
        properties: {
          descripcion: { type: 'string', minLength: 3, maxLength: 120, pattern: String.raw`\S.*\S` },
          valor: { type: 'integer', minimum: 1, maximum: 10000000 },
        },
      },
    },
  }, async (req, rep) => {
    const u = req.usuario!;
    const r = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'cobrarDano', async (tx) => {
      const momento = ahora();
      const est = await estadiaActiva(tx, req.params.id);
      const [c] = await tx.consultar<{ id: string }>(
        `INSERT INTO cargos (estadia_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en)
         VALUES ($1, 'DANO', $2, 1, $3, $3, $4, $5) RETURNING id`,
        [req.params.id, `Daño: ${req.body.descripcion.trim()}`, req.body.valor, u.id, momento]);
      await auditarVarios(tx, [{ usuarioId: u.id, accion: 'CREAR', entidad: 'cargos', entidadId: c.id,
        detalle: { estadia: req.params.id, tipo: 'DANO', valor: String(req.body.valor) }, ocurrido: momento }]);
      await avisarMapa(tx, est.habitacion_numero, req.params.id, momento);
      return { estado: 201, cuerpo: await leerEstadia(tx, req.params.id) };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });
}
