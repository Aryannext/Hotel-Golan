// Cargos a la cuenta de la habitación (FR-06; RN-14, RN-18): productos del catálogo con cantidad.
// Cada cargo guarda el precio del momento: un cambio de precio posterior no lo altera.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { ErrorApi } from '../comun/errores.ts';
import { conIdempotencia } from '../comun/idempotencia.ts';
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

export function rutasCargos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.post<{ Params: { id: string }; Body: Cuerpo; Headers: { 'idempotency-key'?: string } }>('/estadias/:id/cargos', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
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
      for (const item of req.body.items) {
        const [p] = await tx.consultar<{ id: string; nombre: string; precio: number; activo: boolean }>(
          'SELECT id, nombre, precio, activo FROM productos WHERE id = $1', [item.producto_id]);
        if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Ese producto no existe en el catálogo.');
        if (!p.activo) throw new ErrorApi(409, 'CONFLICTO', `«${p.nombre}» ya no está a la venta.`);
        const tipo = tipoDeCargo(p.nombre);
        const [c] = await tx.consultar<{ id: string }>(
          `INSERT INTO cargos (estadia_id, producto_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [req.params.id, p.id, tipo, p.nombre, item.cantidad, p.precio, p.precio * item.cantidad, u.id, momento]);
        await auditar(tx, {
          usuarioId: u.id, accion: 'CREAR', entidad: 'cargos', entidadId: c.id,
          detalle: { estadia: req.params.id, tipo, valor: String(p.precio * item.cantidad) }, ocurrido: momento,
        });
      }
      // El mapa muestra el saldo: se avisa que la habitación cambió.
      await tx.consultar('INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)',
        ['habitacion.actualizada', JSON.stringify({ numero: est.habitacion_numero, entidad_id: req.params.id }), momento]);
      return { estado: 201, cuerpo: await leerEstadia(tx, req.params.id) };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });
}
