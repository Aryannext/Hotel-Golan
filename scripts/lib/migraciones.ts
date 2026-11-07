// Aplica en orden los archivos db/migraciones/NNNN_*.sql que todavía no se hayan aplicado.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Bd } from './bd.ts';

export const DIR_MIGRACIONES = join(import.meta.dirname, '..', '..', 'db', 'migraciones');

const CANDADO_MIGRACIONES = 4207; // pg_advisory_lock: dos procesos no migran a la vez (HG-HAL-001 HAL-29)

async function crearRegistro(bd: Bd) {
  await bd.ejecutar(`CREATE TABLE IF NOT EXISTS schema_migraciones (
    nombre text PRIMARY KEY,
    aplicada_en timestamptz NOT NULL DEFAULT now()
  )`);
}

/** Las migraciones de la carpeta que todavía no están registradas, en orden. */
export async function migracionesPendientes(bd: Bd, dir = DIR_MIGRACIONES): Promise<string[]> {
  await crearRegistro(bd);
  const aplicadas = new Set((await bd.consultar<{ nombre: string }>('SELECT nombre FROM schema_migraciones')).map((f) => f.nombre));
  return (await readdir(dir)).filter((n) => /^\d{4}_.+\.sql$/.test(n)).sort().filter((n) => !aplicadas.has(n));
}

/**
 * Cada migración trae su BEGIN/COMMIT; su registro se agrega antes de ese COMMIT, en la misma transacción (HAL-29):
 * si algo falla, no queda aplicada a medias ni registrada sin aplicar, y las siguientes no corren.
 */
function conRegistro(nombre: string, sql: string): string {
  const fin = sql.lastIndexOf('COMMIT;');
  if (!/^\s*(--[^\n]*\n\s*)*BEGIN;/m.test(sql) || fin < 0) {
    throw new Error(`La migración ${nombre} debe ir entre BEGIN; y COMMIT; para aplicarse completa o nada.`);
  }
  const registro = `INSERT INTO schema_migraciones (nombre) VALUES ('${nombre.replaceAll("'", "''")}');\n`;
  return sql.slice(0, fin) + registro + sql.slice(fin);
}

export async function aplicarMigraciones(bd: Bd, dir = DIR_MIGRACIONES): Promise<string[]> {
  await crearRegistro(bd);
  await bd.consultar('SELECT pg_advisory_lock($1)', [CANDADO_MIGRACIONES]);
  try {
    const nuevas: string[] = [];
    // Una tras otra a propósito: cada migración depende de las anteriores.
    for (const nombre of await migracionesPendientes(bd, dir)) {
      const sql = await readFile(join(dir, nombre), 'utf8'); // NOSONAR: el orden de las migraciones es obligatorio
      const script = conRegistro(nombre, sql);
      try {
        await bd.ejecutar(script); // NOSONAR: el orden de las migraciones es obligatorio
      } catch (error) {
        await bd.ejecutar('ROLLBACK').catch(() => undefined); // si quedó una transacción abierta a medias
        throw error;
      }
      nuevas.push(nombre);
    }
    return nuevas;
  } finally {
    await bd.consultar('SELECT pg_advisory_unlock($1)', [CANDADO_MIGRACIONES]);
  }
}
