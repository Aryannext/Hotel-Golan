// HG-HAL-001 HAL-27 · cabeceras de seguridad sin dependencias nuevas: la página no se puede incrustar en otra, el
// navegador no adivina tipos, no se manda la dirección de origen, y las respuestas de la API no se guardan en caché.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
before(async () => { e = await crearEntorno(); });
after(async () => e.cerrar());

describe('HAL-27 — cabeceras de seguridad', () => {
  it('toda respuesta lleva nosniff, sin referrer, sin marcos y con política de contenido', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/salud' });
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['referrer-policy'], 'no-referrer');
    assert.equal(r.headers['x-frame-options'], 'DENY');
    const csp = String(r.headers['content-security-policy']);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  });

  it('las respuestas de la API (con datos del hotel) no se guardan en caché', async () => {
    const admin = await e.entrar('admin');
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/habitaciones', headers: { cookie: admin } });
    assert.equal(r.headers['cache-control'], 'no-store');
  });
});
