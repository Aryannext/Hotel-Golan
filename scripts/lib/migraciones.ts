// Aplica en orden los archivos db/migraciones/NNNN_*.sql que todavía no se hayan aplicado.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Bd } from './bd.ts';

export const DIR_MIGRACIONES = join(import.meta.dirname, '..', '..', 'db', 'migraciones');

export async function aplicarMigraciones(bd: Bd, dir = DIR_MIGRACIONES): Promise<string[]> {
  await bd.ejecutar(`CREATE TABLE IF NOT EXISTS schema_migraciones (
    nombre text PRIMARY KEY,
    aplicada_en timestamptz NOT NULL DEFAULT now()
  )`);
  const aplicadas = new Set(
    (await bd.consultar<{ nombre: string }>('SELECT nombre FROM schema_migraciones')).map((f) => f.nombre),
  );
  const archivos = (await readdir(dir)).filter((n) => /^\d{4}_.+\.sql$/.test(n)).sort();
  const nuevas: string[] = [];
  for (const nombre of archivos) {
    if (aplicadas.has(nombre)) continue;
    // Cada archivo trae su propio BEGIN/COMMIT.
    await bd.ejecutar(await readFile(join(dir, nombre), 'utf8'));
    await bd.consultar('INSERT INTO schema_migraciones (nombre) VALUES ($1)', [nombre]);
    nuevas.push(nombre);
  }
  return nuevas;
}
