import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';
import { construirApp } from './app.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { conectarPglite } from '../../scripts/lib/bd.ts';
import { aplicarMigraciones } from '../../scripts/lib/migraciones.ts';
import { sembrar } from '../../scripts/lib/semilla.ts';

let e: Entorno, admin: string, recepcion: string, producto: string, foto: string;
before(async () => {
  e = await crearEntorno(); admin = await e.entrar('admin'); recepcion = await e.entrar('recepcion1');
  const [p] = await e.bd.consultar<{ id: string }>("SELECT id FROM productos WHERE nombre = 'Agua'");
  producto = `producto-${p.id}`;
  foto = 'data:image/png;base64,' + (await sharp({ create: { width: 40, height: 30, channels: 3, background: '#dc2828' } }).png().toBuffer()).toString('base64');
});

it('conserva una foto después de cerrar y volver a abrir la base persistente en disco', async () => {
  const directorio = await mkdtemp(join(tmpdir(), 'golan-fotos-test-'));
  const reloj = () => new Date('2026-10-13T06:10:00-05:00');
  let bd = await conectarPglite(directorio);
  let app: Awaited<ReturnType<typeof construirApp>> | undefined;
  try {
    await aplicarMigraciones(bd); await sembrar(bd, '135790');
    app = await construirApp({ bd, ahora: reloj });
    const login = await app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { usuario: 'admin', pin: '135790' } });
    const cookie = `sesion=${login.cookies.find(c => c.name === 'sesion')!.value}`;
    const carga = await app.inject({ method: 'PUT', url: '/api/v1/fotos/201', headers: { cookie }, payload: { imagen: foto } });
    assert.equal(carga.statusCode, 200, carga.body);
    const version = carga.json().version;
    await app.close(); app = undefined; await bd.cerrar();
    bd = await conectarPglite(directorio);
    app = await construirApp({ bd, ahora: reloj });
    const leida = await app.inject({ method: 'GET', url: '/api/v1/fotos/201', headers: { cookie } });
    assert.equal(leida.statusCode, 200); assert.equal(leida.headers.etag, `"${version}"`);
    assert.equal((await sharp(leida.rawPayload).metadata()).width, 40);
  } finally {
    await app?.close(); await bd.cerrar();
    // Solo elimina la carpeta temporal creada por esta prueba, nunca una base del proyecto.
    if (resolve(directorio).startsWith(resolve(tmpdir()) + sep) && basename(directorio).startsWith('golan-fotos-test-')) await rm(directorio, { recursive: true, force: true });
  }
});
after(async () => e.cerrar());
const put = (clave: string, imagen = foto, cookie = admin, importar = false) => e.app.inject({ method: 'PUT', url: `/api/v1/fotos/${clave}`, headers: { cookie, ...(importar ? { 'if-none-match': '*' } : {}) }, payload: { imagen } });

describe('Fotos compartidas — lectura de recepción y edición exclusiva de administración', () => {
  it('exige sesión para listar y leer; recepción no puede subir ni borrar', async () => {
    assert.equal((await e.app.inject({ method: 'GET', url: '/api/v1/fotos' })).statusCode, 401);
    assert.equal((await e.app.inject({ method: 'GET', url: '/api/v1/fotos/201' })).statusCode, 401);
    assert.equal((await put('201', foto, recepcion)).statusCode, 403);
    assert.equal((await e.app.inject({ method: 'DELETE', url: '/api/v1/fotos/201', headers: { cookie: recepcion } })).statusCode, 403);
    assert.equal((await put('201', foto, '')).statusCode, 401);
  });
  it('admin comparte foto de producto y otra sesión de recepción obtiene la imagen decodificada', async () => {
    const r = await put(producto); assert.equal(r.statusCode, 200, r.body);
    const lista = await e.app.inject({ method: 'GET', url: '/api/v1/fotos', headers: { cookie: recepcion } });
    assert.equal(lista.json().find((f: { clave: string }) => f.clave === producto).tiene_foto, true);
    const leida = await e.app.inject({ method: 'GET', url: `/api/v1/fotos/${producto}`, headers: { cookie: recepcion } });
    assert.equal(leida.statusCode, 200); assert.match(leida.headers['content-type']!, /image\/jpeg/);
    assert.equal(leida.headers['x-content-type-options'], 'nosniff'); assert.match(leida.headers['cache-control']!, /private/);
    const meta = await sharp(leida.rawPayload).metadata();
    assert.equal(meta.width, 40); assert.equal(meta.height, 30); assert.equal(meta.exif, undefined);
    assert.ok(!lista.body.includes('base64'));
  });
  it('persisten al construir otro servidor sobre la misma base, sin almacenamiento local del cliente', async () => {
    const otraApp = await construirApp({ bd: e.bd, ahora: () => new Date('2026-10-13T06:10:00-05:00') });
    try {
      const r = await otraApp.inject({ method: 'GET', url: `/api/v1/fotos/${producto}`, headers: { cookie: recepcion } });
      assert.equal(r.statusCode, 200); assert.equal((await sharp(r.rawPayload).metadata()).width, 40);
    } finally { await otraApp.close(); }
  });
  it('rechaza archivos disfrazados, SVG, base64 inválido, imágenes enormes y recursos inexistentes', async () => {
    assert.equal((await put('201', 'data:image/svg+xml;base64,PHN2Zz4=')).statusCode, 400);
    assert.equal((await put('201', foto.replace('image/png', 'image/jpeg'))).statusCode, 400);
    assert.equal((await put('201', 'data:image/png;base64,aGVsbG8=')).statusCode, 400);
    assert.equal((await put('201', 'data:image/png;base64,AAAA===')).statusCode, 400);
    const enorme = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: 'white' } }).png().toBuffer();
    assert.equal((await put('201', 'data:image/png;base64,' + enorme.toString('base64'))).statusCode, 400);
    assert.equal((await put('999')).statusCode, 404);
    assert.equal((await put('producto-00000000-0000-0000-0000-000000000000')).statusCode, 404);
    assert.equal((await put('producto-no-valido')).statusCode, 400);
    const pasada = await put('201', 'data:image/jpeg;base64,' + 'A'.repeat(7_100_000));
    assert.equal(pasada.statusCode, 413);
  });
  it('versiona reemplazos y respeta ETag para no mostrar fotos anteriores desde caché', async () => {
    const a = await put('202'); assert.equal(a.statusCode, 200, a.body);
    const previa = await e.app.inject({ method: 'GET', url: '/api/v1/fotos/202', headers: { cookie: recepcion } });
    const cache = await e.app.inject({ method: 'GET', url: '/api/v1/fotos/202', headers: { cookie: recepcion, 'if-none-match': previa.headers.etag! } });
    assert.equal(cache.statusCode, 304);
    const b = await put('202'); assert.notEqual(a.json().version, b.json().version);
    const nueva = await e.app.inject({ method: 'GET', url: '/api/v1/fotos/202', headers: { cookie: recepcion, 'if-none-match': previa.headers.etag! } });
    assert.equal(nueva.statusCode, 200); assert.notEqual(nueva.headers.etag, previa.headers.etag);
  });
  it('una importación local vieja no pisa una foto compartida ni resucita una eliminada', async () => {
    assert.equal((await put('203', foto, admin, true)).statusCode, 200);
    assert.equal((await put('203', foto, admin, true)).statusCode, 412);
    const borrada = await e.app.inject({ method: 'DELETE', url: '/api/v1/fotos/203', headers: { cookie: admin } });
    assert.equal(borrada.statusCode, 200); assert.equal(borrada.json().tiene_foto, false);
    assert.equal((await put('203', foto, admin, true)).statusCode, 412);
    assert.equal((await e.app.inject({ method: 'GET', url: '/api/v1/fotos/203', headers: { cookie: recepcion } })).statusCode, 404);
    assert.equal((await put('203')).statusCode, 200); // Reemplazo explícito sigue permitido.
  });
  it('recepción no cambia una foto existente y la auditoría no almacena el contenido de la imagen', async () => {
    const antes = await e.app.inject({ method: 'GET', url: `/api/v1/fotos/${producto}`, headers: { cookie: recepcion } });
    assert.equal((await put(producto, foto, recepcion)).statusCode, 403);
    assert.equal((await e.app.inject({ method: 'DELETE', url: `/api/v1/fotos/${producto}`, headers: { cookie: recepcion } })).statusCode, 403);
    const despues = await e.app.inject({ method: 'GET', url: `/api/v1/fotos/${producto}`, headers: { cookie: recepcion } });
    assert.deepEqual(antes.rawPayload, despues.rawPayload);
    const registros = await e.bd.consultar<{ detalle: Record<string, string> }>("SELECT detalle FROM auditoria WHERE entidad = 'fotos_compartidas'");
    assert.ok(registros.length > 0); assert.ok(!JSON.stringify(registros).includes('base64'));
    const eventos = await e.bd.consultar("SELECT id FROM eventos_salida WHERE tipo = 'foto.actualizada'");
    assert.ok(eventos.length > 0);
  });
});
