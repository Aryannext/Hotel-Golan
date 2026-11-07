// HG-HAL-001 HAL-05 · la semilla y `db:reiniciar` (que borra todo el esquema) solo corren en desarrollo: la dirección
// 127.0.0.1 también se cumple en el VPS, así que no basta como protección.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { permisoDatosDePrueba } from './lib/proteccion.ts';

const LOCAL = 'postgres://hotel_golan:x@127.0.0.1:5433/hotel_golan';

describe('HAL-05 — datos de prueba solo en desarrollo', () => {
  it('con HOTEL_ENTORNO=desarrollo y base local: permitido', () => {
    assert.deepEqual(permisoDatosDePrueba({ HOTEL_ENTORNO: 'desarrollo', DATABASE_URL: LOCAL }), { ok: true });
  });

  it('sin HOTEL_ENTORNO (como en el VPS), aunque la base sea 127.0.0.1: no', () => {
    const r = permisoDatosDePrueba({ DATABASE_URL: LOCAL });
    assert.equal(r.ok, false);
    assert.match(r.ok ? '' : r.motivo, /HOTEL_ENTORNO=desarrollo/);
  });

  it('con HOTEL_ENTORNO=produccion: no', () => {
    assert.equal(permisoDatosDePrueba({ HOTEL_ENTORNO: 'produccion', DATABASE_URL: LOCAL }).ok, false);
  });

  it('en desarrollo pero con una base que no es local: no', () => {
    assert.equal(permisoDatosDePrueba({ HOTEL_ENTORNO: 'desarrollo', DATABASE_URL: 'postgres://u:x@10.0.0.5:5432/hotel' }).ok, false);
  });
});
