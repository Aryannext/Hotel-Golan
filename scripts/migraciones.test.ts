// HG-HAL-001 HAL-29 · migraciones menos frágiles: cada una se registra dentro de su propia transacción (si algo falla,
// no queda ni aplicada a medias ni registrada sin aplicar), y el servidor sabe al arrancar si falta alguna.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { conectarPglite } from './lib/bd.ts';
import { aplicarMigraciones, migracionesPendientes } from './lib/migraciones.ts';

async function carpeta(archivos: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'migraciones-'));
  for (const [nombre, sql] of Object.entries(archivos)) await writeFile(join(dir, nombre), sql);
  return dir;
}

describe('HAL-29 — migraciones', () => {
  it('una migración que falla no queda registrada ni a medias, y las siguientes no corren', async () => {
    const bd = await conectarPglite();
    const dir = await carpeta({
      '0001_a.sql': 'BEGIN;\nCREATE TABLE a (x int);\nCOMMIT;\n',
      '0002_b.sql': 'BEGIN;\nCREATE TABLE b (x int);\nSELECT 1/0;\nCOMMIT;\n',
      '0003_c.sql': 'BEGIN;\nCREATE TABLE c (x int);\nCOMMIT;\n',
    });
    await assert.rejects(aplicarMigraciones(bd, dir));
    const registradas = (await bd.consultar<{ nombre: string }>('SELECT nombre FROM schema_migraciones ORDER BY nombre')).map((f) => f.nombre);
    assert.deepEqual(registradas, ['0001_a.sql']);
    const tablas = (await bd.consultar<{ t: string }>(`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('a', 'b', 'c')`)).map((f) => f.t);
    assert.deepEqual(tablas, ['a']);
    assert.deepEqual(await migracionesPendientes(bd, dir), ['0002_b.sql', '0003_c.sql']);
    await bd.cerrar();
  });

  it('una migración sin su BEGIN/COMMIT se rechaza antes de correr', async () => {
    const bd = await conectarPglite();
    const dir = await carpeta({ '0001_sin_transaccion.sql': 'CREATE TABLE z (x int);\n' });
    await assert.rejects(aplicarMigraciones(bd, dir), /BEGIN/);
    assert.deepEqual(await migracionesPendientes(bd, dir), ['0001_sin_transaccion.sql']);
    await bd.cerrar();
  });

  it('las migraciones reales del proyecto se aplican y no queda ninguna pendiente', async () => {
    const bd = await conectarPglite();
    assert.ok((await aplicarMigraciones(bd)).length >= 11);
    assert.deepEqual(await migracionesPendientes(bd), []);
    await bd.cerrar();
  });
});
