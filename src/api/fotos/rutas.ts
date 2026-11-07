import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { ErrorApi } from '../comun/errores.ts';
import { auditar } from '../comun/auditoria.ts';
import { publicarEventos } from '../comun/eventos.ts';

const MAX_BYTES = 5 * 1024 * 1024;
const CLAVE = '^(producto-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9]{3})$';
const params = { type: 'object', required: ['clave'], additionalProperties: false, properties: { clave: { type: 'string', pattern: CLAVE } } };
const invalida = () => new ErrorApi(400, 'INVALID_PAYLOAD', 'Elige una imagen JPG, PNG o WebP válida, de hasta 5 MB y 20 megapíxeles.');
interface Registro { clave: string; version: string; tiene_foto: boolean }

export async function prepararImagen(dataUrl: string): Promise<Buffer> {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!m || m[2].length % 4 !== 0) throw invalida();
  const bytes = Buffer.from(m[2], 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.toString('base64') !== m[2]) throw invalida();
  try {
    const imagen = sharp(bytes, { limitInputPixels: 20_000_000, failOn: 'warning' });
    const meta = await imagen.metadata();
    const formato = m[1] === 'jpeg' ? 'jpeg' : m[1];
    if (meta.format !== formato || !meta.width || !meta.height || (meta.pages ?? 1) !== 1) throw invalida();
    // Decodifica y vuelve a codificar: quita EXIF/metadatos y nunca publica el archivo original.
    return await imagen.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch { throw invalida(); }
}

async function destino(bd: Bd, clave: string) {
  const producto = clave.startsWith('producto-') ? clave.slice(9) : null;
  const [fila] = producto
    ? await bd.consultar('SELECT id FROM productos WHERE id = $1', [producto])
    : await bd.consultar('SELECT numero FROM habitaciones WHERE numero = $1', [clave]);
  if (!fila) throw new ErrorApi(404, 'NO_ENCONTRADO', 'No se encontró el producto o la habitación de esta foto.');
  return { producto, habitacion: producto ? null : clave };
}

export function rutasFotos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const lectura = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);
  const escritura = requiere(bd, ahora, ['ADMINISTRACION']);
  app.get('/fotos', { preHandler: lectura }, async (_req, rep) => {
    rep.header('Cache-Control', 'private, no-store');
    return bd.consultar<Registro>('SELECT clave, version, imagen IS NOT NULL AS tiene_foto FROM fotos_compartidas ORDER BY clave');
  });
  app.get<{ Params: { clave: string } }>('/fotos/:clave', { preHandler: lectura, schema: { params } }, async (req, rep) => {
    const [foto] = await bd.consultar<{ imagen: Uint8Array | null; version: string }>('SELECT imagen, version FROM fotos_compartidas WHERE clave = $1', [req.params.clave]);
    rep.header('Cache-Control', 'private, no-cache').header('X-Content-Type-Options', 'nosniff');
    if (!foto?.imagen) throw new ErrorApi(404, 'NO_ENCONTRADO', 'No hay una fotografía compartida.');
    const etag = `"${foto.version}"`;
    rep.header('ETag', etag);
    if (req.headers['if-none-match'] === etag) return rep.code(304).send();
    return rep.type('image/jpeg').send(Buffer.from(foto.imagen));
  });
  app.put<{ Params: { clave: string }; Body: { imagen: string } }>('/fotos/:clave', {
    preHandler: escritura, bodyLimit: 7_100_000,
    schema: { params, body: { type: 'object', additionalProperties: false, required: ['imagen'], properties: { imagen: { type: 'string', maxLength: 7_000_000 } } } },
  }, async (req, rep) => {
    const clave = req.params.clave.toLowerCase();
    const d = await destino(bd, clave), imagen = await prepararImagen(req.body.imagen), version = randomUUID(), momento = ahora();
    const importar = req.headers['if-none-match'] === '*';
    await bd.transaccion(async tx => {
      const filas = await tx.consultar(
        `INSERT INTO fotos_compartidas (clave, producto_id, habitacion_numero, imagen, version, actualizado_por, actualizado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (clave) ${importar ? 'DO NOTHING' : 'DO UPDATE SET imagen = EXCLUDED.imagen, version = EXCLUDED.version, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = EXCLUDED.actualizado_en'} RETURNING clave`,
        [clave, d.producto, d.habitacion, imagen, version, req.usuario!.id, momento]);
      if (!filas.length) throw new ErrorApi(412, 'CONFLICTO', 'Ya existe una versión compartida. Se conservará esa versión.');
      await auditar(tx, { usuarioId: req.usuario!.id, accion: 'ACTUALIZAR', entidad: 'fotos_compartidas', entidadId: clave, detalle: { bytes: String(imagen.length) }, ocurrido: momento });
      await publicarEventos(tx, [['foto.actualizada', { entidad_id: clave }]], momento);
    });
    rep.header('Cache-Control', 'no-store');
    return { clave, version, tiene_foto: true } satisfies Registro;
  });
  app.delete<{ Params: { clave: string } }>('/fotos/:clave', { preHandler: escritura, schema: { params } }, async (req, rep) => {
    const clave = req.params.clave.toLowerCase(), d = await destino(bd, clave), version = randomUUID(), momento = ahora();
    await bd.transaccion(async tx => {
      await tx.consultar(
        `INSERT INTO fotos_compartidas (clave, producto_id, habitacion_numero, imagen, version, actualizado_por, actualizado_en)
         VALUES ($1,$2,$3,NULL,$4,$5,$6) ON CONFLICT (clave) DO UPDATE SET imagen = NULL, version = EXCLUDED.version, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = EXCLUDED.actualizado_en`,
        [clave, d.producto, d.habitacion, version, req.usuario!.id, momento]);
      await auditar(tx, { usuarioId: req.usuario!.id, accion: 'ANULAR', entidad: 'fotos_compartidas', entidadId: clave, ocurrido: momento });
      await publicarEventos(tx, [['foto.actualizada', { entidad_id: clave }]], momento);
    });
    rep.header('Cache-Control', 'no-store');
    return { clave, version, tiene_foto: false } satisfies Registro;
  });
}
