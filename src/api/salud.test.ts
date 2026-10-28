// HG-HAL-001 HAL-06 · una ruta de salud sin sesión para el monitoreo y el reinicio automático del VPS (TICKET-19):
// responde 200 si la base contesta y 503 si no. No expone datos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno } from './pruebas/entorno.ts';
import { construirApp } from './app.ts';
import type { Bd } from '../../scripts/lib/bd.ts';

describe('HAL-06 — GET /api/v1/salud', () => {
  it('con la base respondiendo: 200 { estado: "ok" }, sin sesión', async () => {
    const e = await crearEntorno();
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/salud' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json(), { estado: 'ok' });
    await e.cerrar();
  });

  it('si la base no contesta: 503 { estado: "sin_base" }', async () => {
    const caida: Bd = {
      consultar: () => Promise.reject(new Error('connect ECONNREFUSED')),
      ejecutar: () => Promise.reject(new Error('connect ECONNREFUSED')),
      transaccion: () => Promise.reject(new Error('connect ECONNREFUSED')),
      cerrar: async () => undefined,
    };
    const app = await construirApp({ bd: caida });
    const r = await app.inject({ method: 'GET', url: '/api/v1/salud' });
    assert.equal(r.statusCode, 503);
    assert.deepEqual(r.json(), { estado: 'sin_base' });
    await app.close();
  });
});
