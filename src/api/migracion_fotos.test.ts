// La migración 0011 reemplaza la restricción de tipos de `eventos_salida`, que es una
// tabla del núcleo y ya tiene filas en cualquier base que lleve tiempo andando.
//
// El resto de las pruebas aplica las once migraciones de una vez sobre una base vacía,
// así que nunca recorre el camino real: una base con datos que recibe la 0011 encima.
// Esto lo recorre: aplica hasta la 0010, guarda un evento de cada tipo y solo entonces
// aplica la 0011.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { conectarPglite, type Bd } from '../../scripts/lib/bd.ts';
import { aplicarMigraciones, DIR_MIGRACIONES } from '../../scripts/lib/migraciones.ts';

/** Los tipos que la 0001 ya aceptaba; ninguno puede perderse al ampliar la lista. */
const TIPOS_ANTERIORES = [
  'habitacion.actualizada', 'estadia.creada', 'estadia.cerrada',
  'pago.por_verificar', 'pago.verificado', 'pago.rechazado',
  'turno.entregado', 'turno.recibido', 'turno.diferencia', 'caja.movimiento',
];

/** Copia a una carpeta aparte solo las migraciones anteriores a la 0011. */
async function dirHastaLa0010(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'golan-migraciones-'));
  for (const nombre of (await readdir(DIR_MIGRACIONES)).filter((n) => /^\d{4}_.+\.sql$/.test(n))) {
    if (nombre < '0011') await cp(join(DIR_MIGRACIONES, nombre), join(dir, nombre));
  }
  return dir;
}

describe('migración 0011 sobre una base que ya tiene datos', () => {
  let bd: Bd;
  let dirParcial: string;

  before(async () => {
    dirParcial = await dirHastaLa0010();
    bd = await conectarPglite();
    await aplicarMigraciones(bd, dirParcial);
    // Una fila de cada tipo anterior: es lo que habría en la base de Cristian.
    for (const tipo of TIPOS_ANTERIORES) {
      await bd.consultar('INSERT INTO eventos_salida (tipo, payload) VALUES ($1, $2)', [tipo, { previo: true }]);
    }
  });

  after(async () => {
    await bd.cerrar();
    await rm(dirParcial, { recursive: true, force: true });
  });

  it('la aplica sin perder ninguno de los eventos que ya estaban', async () => {
    const aplicadas = await aplicarMigraciones(bd);
    assert.deepEqual(aplicadas, ['0011_fotos_compartidas.sql']);

    const filas = await bd.consultar<{ tipo: string }>('SELECT tipo FROM eventos_salida ORDER BY id');
    assert.deepEqual(filas.map((f) => f.tipo), TIPOS_ANTERIORES);
  });

  it('deja la tabla aceptando los tipos de siempre y además el nuevo', async () => {
    for (const tipo of [...TIPOS_ANTERIORES, 'foto.actualizada']) {
      await bd.consultar('INSERT INTO eventos_salida (tipo, payload) VALUES ($1, $2)', [tipo, {}]);
    }
    const cuenta = await bd.consultar<{ n: string }>(
      'SELECT count(*) AS n FROM eventos_salida WHERE tipo = $1', ['foto.actualizada']);
    assert.equal(Number(cuenta[0].n), 1);
  });

  it('sigue rechazando un tipo que no existe', async () => {
    await assert.rejects(
      () => bd.consultar('INSERT INTO eventos_salida (tipo, payload) VALUES ($1, $2)', ['foto.inventada', {}]),
      /eventos_salida_tipo_check/,
    );
  });

  it('no deja rastro de la comprobación que hace la propia migración', async () => {
    const sobrantes = await bd.consultar(
      `SELECT 1 FROM eventos_salida WHERE payload->>'comprobacion' IS NOT NULL`);
    assert.equal(sobrantes.length, 0);
  });

  it('la tabla de fotos quedó creada y atada a habitaciones y productos', async () => {
    const columnas = await bd.consultar<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'fotos_compartidas' ORDER BY column_name`);
    assert.deepEqual(columnas.map((c) => c.column_name), [
      'actualizado_en', 'actualizado_por', 'clave', 'habitacion_numero', 'imagen', 'producto_id', 'version',
    ]);
  });
});
