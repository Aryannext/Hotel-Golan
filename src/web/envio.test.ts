// HG-HAL-001 HAL-09 · después de un cobro que sí quedó, la pantalla no puede decir «No se pudo conectar»: eso invita
// a cobrar otra vez. La operación y la relectura de la cuenta fallan por separado.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorApi } from './api.ts';
import { GUARDADO_SIN_ACTUALIZAR, SIN_CONEXION, enviarYReleer, mensajeDeError } from './envio.ts';

const falla = (e: unknown) => () => Promise.reject(e);

describe('HAL-09 — el error de la operación y el de la relectura se distinguen', () => {
  it('todo bien: hecho, con el resultado y sin aviso', async () => {
    let releida = false;
    assert.deepEqual(await enviarYReleer(async () => 'pago-1', async () => { releida = true; }), { hecho: true, resultado: 'pago-1', aviso: '' });
    assert.ok(releida);
  });

  it('el cobro quedó pero no se pudo releer la cuenta: hecho, con el aviso de no repetirlo', async () => {
    const r = await enviarYReleer(async () => 'pago-1', falla(new TypeError('Failed to fetch')));
    assert.deepEqual(r, { hecho: true, resultado: 'pago-1', aviso: GUARDADO_SIN_ACTUALIZAR });
    assert.match(GUARDADO_SIN_ACTUALIZAR, /Quedó guardado/);
    assert.match(GUARDADO_SIN_ACTUALIZAR, /No lo repita/);
  });

  it('el cobro no llegó (sin señal): no hecho, y se puede intentar de nuevo sin duplicar', async () => {
    let releida = false;
    const r = await enviarYReleer(falla(new TypeError('Failed to fetch')), async () => { releida = true; });
    assert.deepEqual(r, { hecho: false, error: SIN_CONEXION });
    assert.equal(releida, false);
  });

  it('el sistema rechazó el cobro: no hecho, con el mensaje del sistema', async () => {
    const r = await enviarYReleer(falla(new ErrorApi(409, 'CONFLICTO', 'Ese pedido ya está pagado.')), async () => undefined);
    assert.deepEqual(r, { hecho: false, error: 'Ese pedido ya está pagado.' });
  });

  it('mensajeDeError: el de la API en palabras, o el de sin conexión (nunca «Failed to fetch» en inglés)', () => {
    assert.equal(mensajeDeError(new ErrorApi(422, 'X', 'No alcanza la caja.')), 'No alcanza la caja.');
    assert.equal(mensajeDeError(new TypeError('Failed to fetch')), SIN_CONEXION);
  });
});
