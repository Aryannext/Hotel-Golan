// Acceso mínimo a la base de datos, común a PostgreSQL real (pg) y a PGlite (verificación local sin Docker).
import pg from 'pg';

export interface Bd {
  consultar<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Ejecuta un script con varias sentencias y sin parámetros (migraciones). */
  ejecutar(sql: string): Promise<void>;
  transaccion<T>(fn: (bd: Bd) => Promise<T>): Promise<T>;
  cerrar(): Promise<void>;
}

type ClientePg = pg.Pool | pg.PoolClient;

function envolverPg(cliente: ClientePg, pool: pg.Pool): Bd {
  return {
    async consultar(sql, params) {
      return (await cliente.query(sql, params as unknown[] | undefined)).rows;
    },
    async ejecutar(sql) {
      await cliente.query(sql);
    },
    async transaccion(fn) {
      const conexion = await pool.connect();
      try {
        await conexion.query('BEGIN');
        const resultado = await fn(envolverPg(conexion, pool));
        await conexion.query('COMMIT');
        return resultado;
      } catch (error) {
        await conexion.query('ROLLBACK');
        throw error;
      } finally {
        conexion.release();
      }
    },
    async cerrar() {
      if (cliente === pool) await pool.end();
    },
  };
}

export function conectarPostgres(url = process.env.DATABASE_URL): Bd {
  if (!url) throw new Error('Falta DATABASE_URL. Copie .env.example como .env y complételo.');
  const pool = new pg.Pool({ connectionString: url, max: 4 });
  return envolverPg(pool, pool);
}

export async function conectarPglite(): Promise<Bd> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  // PGlite no es multiusuario: las transacciones se serializan con BEGIN/COMMIT explícitos.
  const bd: Bd = {
    async consultar(sql, params) {
      return (await db.query(sql, params as unknown[] | undefined)).rows as never[];
    },
    async ejecutar(sql) {
      await db.exec(sql);
    },
    async transaccion(fn) {
      await db.exec('BEGIN');
      try {
        const resultado = await fn(bd);
        await db.exec('COMMIT');
        return resultado;
      } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
      }
    },
    async cerrar() {
      await db.close();
    },
  };
  return bd;
}
