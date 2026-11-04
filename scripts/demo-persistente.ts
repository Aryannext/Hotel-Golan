// Demo local persistente; no usa PostgreSQL real ni sustituye al servidor de producción.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { conectarPglite } from './lib/bd.ts';
import { aplicarMigraciones } from './lib/migraciones.ts';
import { sembrar } from './lib/semilla.ts';
import { construirApp } from '../src/api/app.ts';

const raiz = resolve(import.meta.dirname, '..');
const puerto = Number(process.env.DEMO_PUERTO ?? 3000);
if (!Number.isInteger(puerto) || puerto < 1024 || puerto > 65535) throw new Error('DEMO_PUERTO debe estar entre 1024 y 65535.');
const directorio = resolve(raiz, '.pglite', 'demo-compartida');
await mkdir(directorio, { recursive: true });
const bd = await conectarPglite(directorio);
try {
  await aplicarMigraciones(bd);
  const [{ n }] = await bd.consultar<{ n: number }>('SELECT count(*)::int n FROM usuarios');
  if (!n) await sembrar(bd, process.env.SEMILLA_PIN_PRUEBA || '135790');
  const app = await construirApp({ bd, dirWeb: resolve(raiz, process.env.DEMO_WEB_DIR ?? 'dist/web') });
  await app.listen({ host: '127.0.0.1', port: puerto });
  console.log(`Demo con fotos persistentes lista en http://127.0.0.1:${puerto}/ (datos de ejemplo).`);
  let cerrando = false;
  for (const senal of ['SIGINT', 'SIGTERM'] as const) process.on(senal, async () => {
    if (cerrando) return; cerrando = true;
    await app.close(); await bd.cerrar(); process.exit(0);
  });
} catch (e) { await bd.cerrar(); throw e; }
