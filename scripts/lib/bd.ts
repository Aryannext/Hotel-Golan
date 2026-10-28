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
        // Si la conexión ya se cayó, el ROLLBACK también falla: se informa el error original, no ese.
        await conexion.query('ROLLBACK').catch(() => undefined);
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

export function conectarPostgres(url = process.env.DATABASE_URL, alFallar: (error: Error) => void = () => undefined): Bd {
  if (!url) throw new Error('Falta DATABASE_URL. Copie .env.example como .env y complételo.');
  const pool = new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 });
  // HG-HAL-001 HAL-06: si PostgreSQL se reinicia, una conexión inactiva emite «error»; sin este manejador, Node se cae.
  pool.on('error', alFallar);
  return envolverPg(pool, pool);
}

export async function conectarPglite(): Promise<Bd> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  // PGlite tiene una sola conexión: un candado serializa las transacciones (como haría PostgreSQL con varias
  // conexiones y bloqueos de fila) y las consultas sueltas esperan a que termine la transacción en curso.
  let cola: Promise<unknown> = Promise.resolve();
  const enExclusiva = <T>(fn: () => Promise<T>): Promise<T> => {
    const turno = cola.then(fn, fn);
    cola = turno.catch(() => undefined);
    return turno;
  };
  const dentro: Bd = {
    async consultar(sql, params) {
      return (await db.query(sql, params as unknown[] | undefined)).rows as never[];
    },
    async ejecutar(sql) {
      await db.exec(sql);
    },
    async transaccion(fn) {
      return fn(dentro); // Ya dentro de una transacción: no se anida.
    },
    async cerrar() {
      await db.close();
    },
  };
  return {
    consultar: (sql, params) => enExclusiva(() => dentro.consultar(sql, params)),
    ejecutar: (sql) => enExclusiva(() => dentro.ejecutar(sql)),
    transaccion: (fn) => enExclusiva(async () => {
      await db.exec('BEGIN');
      try {
        const resultado = await fn(dentro);
        await db.exec('COMMIT');
        return resultado;
      } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
      }
    }),
    cerrar: () => enExclusiva(() => db.close()),
  };
}
