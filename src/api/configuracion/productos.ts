// Catálogo para cargos (FR-06) y su configuración (FR-22, FR-24): la administración crea y edita productos de todos los grupos.
// Los productos de la familiar de la dueña no van en el sistema, estén en la sección que estén (RN-13, V5-19): todo
// producto es del hotel. Antes se bloqueaba la sección 1 por número (T4-10).
// Un cambio de precio aplica a los cargos nuevos: cada cargo guarda su valor unitario al registrarse.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { ErrorApi, sinPermiso } from '../comun/errores.ts';

const UNICO_VIOLADO = '23505';
const COLUMNAS = 'id, nombre, grupo, precio, seccion, pertenece_a, activo';

interface ProductoInput { nombre: string; grupo: string; precio: number; seccion?: number; pertenece_a?: 'HOTEL'; activo: boolean }
interface FilaProducto { id: string; nombre: string; grupo: string; precio: number; seccion: number | null; pertenece_a: string; activo: boolean }

const ESQUEMA_PRODUCTO = {
  type: 'object', additionalProperties: false, required: ['nombre', 'grupo', 'precio', 'activo'],
  properties: {
    nombre: { type: 'string', minLength: 2, maxLength: 80 },
    grupo: { type: 'string', enum: ['NEVERA', 'VITRINA_ASEO', 'VITRINA_PASABOCAS', 'LAVANDERIA', 'OTROS'] },
    precio: { type: 'integer', minimum: 0, maximum: 10000000 },
    seccion: { type: 'integer', minimum: 1, maximum: 6 },
    pertenece_a: { type: 'string', enum: ['HOTEL'] },
    activo: { type: 'boolean' },
  },
};

const repetido = (error: unknown, nombre: string) => (error as { code?: string }).code === UNICO_VIOLADO
  ? new ErrorApi(409, 'CONFLICTO', `Ya existe «${nombre}» en ese grupo.`)
  : error;

/** Solo lo que cambió: precio, activo y el resto de campos del catálogo (no hay datos personales). */
function diferencias(antes: FilaProducto, p: FilaProducto): Record<string, string> {
  const d: Record<string, string> = {};
  if (antes.nombre !== p.nombre) d.nombre = p.nombre;
  if (antes.grupo !== p.grupo) d.grupo = p.grupo;
  if (antes.precio !== p.precio) d.precio = String(p.precio);
  if (antes.seccion !== p.seccion) d.seccion = String(p.seccion ?? '');
  if (antes.pertenece_a !== p.pertenece_a) d.pertenece_a = p.pertenece_a;
  if (antes.activo !== p.activo) d.activo = p.activo ? 'si' : 'no';
  return d;
}

export function rutasProductos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const soloAdministracion = requiere(bd, ahora, ['ADMINISTRACION']);

  app.get<{ Querystring: { incluir_inactivos?: boolean } }>('/productos', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: { querystring: { type: 'object', additionalProperties: false, properties: { incluir_inactivos: { type: 'boolean', default: false } } } },
  }, async (req) => {
    // Los productos desactivados solo los ve la administración, para poder reactivarlos.
    if (req.query.incluir_inactivos && req.usuario!.rol !== 'ADMINISTRACION') throw sinPermiso();
    return { items: await bd.consultar(
      `SELECT ${COLUMNAS} FROM productos WHERE activo OR $1 ORDER BY grupo, nombre`, [!!req.query.incluir_inactivos]) };
  });

  app.post<{ Body: ProductoInput }>('/productos', { preHandler: soloAdministracion, schema: { body: ESQUEMA_PRODUCTO } }, async (req, rep) => {
    const p = req.body;
    const nombre = p.nombre.trim();
    const momento = ahora();
    const fila = await bd.transaccion(async (tx) => {
      let f: FilaProducto;
      try {
        [f] = await tx.consultar<FilaProducto>(
          `INSERT INTO productos (nombre, grupo, precio, seccion, pertenece_a, activo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNAS}`,
          [nombre, p.grupo, p.precio, p.seccion ?? null, 'HOTEL', p.activo]);
      } catch (error) { throw repetido(error, nombre); }
      await auditar(tx, { usuarioId: req.usuario!.id, accion: 'CREAR', entidad: 'productos', entidadId: f.id, detalle: { precio: String(p.precio) }, ocurrido: momento });
      return f;
    });
    return rep.code(201).send(fila);
  });

  app.put<{ Params: { id: string }; Body: ProductoInput }>('/productos/:id', {
    preHandler: soloAdministracion,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }, body: ESQUEMA_PRODUCTO },
  }, async (req) => {
    const p = req.body;
    const nombre = p.nombre.trim();
    const momento = ahora();
    return bd.transaccion(async (tx) => {
      const [antes] = await tx.consultar<FilaProducto>(`SELECT ${COLUMNAS} FROM productos WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!antes) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El producto no existe.');
      let f: FilaProducto;
      try {
        [f] = await tx.consultar<FilaProducto>(
          `UPDATE productos SET nombre = $2, grupo = $3, precio = $4, seccion = $5, pertenece_a = $6, activo = $7 WHERE id = $1 RETURNING ${COLUMNAS}`,
          [req.params.id, nombre, p.grupo, p.precio, p.seccion ?? null, 'HOTEL', p.activo]);
      } catch (error) { throw repetido(error, nombre); }
      const detalle = diferencias(antes, f);
      if (Object.keys(detalle).length > 0) {
        await auditar(tx, { usuarioId: req.usuario!.id, accion: 'ACTUALIZAR', entidad: 'productos', entidadId: f.id, detalle, ocurrido: momento });
      }
      return f;
    });
  });
}
