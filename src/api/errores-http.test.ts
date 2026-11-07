// HG-HAL-001 HAL-12 · un envío mal formado es un error de quien lo envía (4xx), no del sistema (500): el manejador
// respeta el estado que pone Fastify y responde con el formato de error del contrato.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
before(async () => { e = await crearEntorno(); });
after(async () => e.cerrar());

const enviar = (payload: string, tipo = 'application/json') =>
  e.app.inject({ method: 'POST', url: '/api/v1/sesiones', headers: { 'content-type': tipo }, payload });

describe('HAL-12 — los errores de quien envía no son 500', () => {
  it('JSON mal formado: 400 INVALID_PAYLOAD', async () => {
    const r = await enviar('{malo');
    assert.equal(r.statusCode, 400, r.body);
    assert.equal(r.json().codigo, 'INVALID_PAYLOAD');
    assert.equal(r.json().mensaje, 'Los datos enviados no son válidos.');
  });

  it('un tipo de contenido que no es JSON: 415 INVALID_PAYLOAD', async () => {
    const r = await enviar('<usuario>x</usuario>', 'application/xml');
    assert.equal(r.statusCode, 415, r.body);
    assert.deepEqual(r.json(), { codigo: 'INVALID_PAYLOAD', mensaje: 'Envíe los datos en formato JSON.' });
  });

  it('un envío demasiado grande: 413 INVALID_PAYLOAD', async () => {
    const r = await enviar(JSON.stringify({ usuario: 'x'.repeat(1_100_000), pin: '000000' }));
    assert.equal(r.statusCode, 413, r.body);
    assert.deepEqual(r.json(), { codigo: 'INVALID_PAYLOAD', mensaje: 'El envío es demasiado grande.' });
  });
});
