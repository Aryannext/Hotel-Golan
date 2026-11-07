// HG-HAL-001 HAL-19 · la confirmación de una transferencia («Llegó» / «No llegó», RN-12) usa la misma idempotencia que
// el resto de la API: una clave de otra operación responde 409, no la respuesta de esa otra operación; y una segunda
// decisión con otra clave sobre un pago ya decidido responde 409, en vez de devolver en silencio la primera.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let admin: string;
let pago: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:15:00-05:00');
  admin = await e.entrar('admin');
  [{ id: pago }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM pagos WHERE estado = 'POR_VERIFICAR' AND anulado_en IS NULL LIMIT 1`);
});
after(async () => e.cerrar());

const verificar = (id: string, resultado: 'LLEGO' | 'NO_LLEGO', clave: string) => e.app.inject({
  method: 'POST', url: `/api/v1/pagos/${id}/verificacion`, payload: { resultado }, headers: { cookie: admin, 'idempotency-key': clave },
});

describe('HAL-19 — la verificación usa la idempotencia común', () => {
  it('una clave que ya se usó en otra operación: 409, y el pago sigue por confirmar', async () => {
    const clave = randomUUID();
    const [{ id: producto }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM productos WHERE grupo = 'NEVERA' AND activo LIMIT 1`);
    const otra = await e.app.inject({ method: 'POST', url: '/api/v1/surtidos', payload: { producto_id: producto, cantidad: 1 }, headers: { cookie: admin, 'idempotency-key': clave } });
    assert.equal(otra.statusCode, 201, otra.body);
    assert.equal((await verificar(pago, 'LLEGO', clave)).statusCode, 409);
    const [p] = await e.bd.consultar<{ estado: string }>('SELECT estado FROM pagos WHERE id = $1', [pago]);
    assert.equal(p.estado, 'POR_VERIFICAR');
  });

  it('«Llegó» repetido con la misma clave: lo mismo, una sola vez', async () => {
    const clave = randomUUID();
    const a = await verificar(pago, 'LLEGO', clave);
    const b = await verificar(pago, 'LLEGO', clave);
    assert.equal(a.statusCode, 200, a.body);
    assert.deepEqual(b.json(), a.json());
    assert.equal(a.json().estado, 'VERIFICADO');
  });

  it('después de «Llegó», un «No llegó» con su propia clave: 409, no se cambia en silencio', async () => {
    const r = await verificar(pago, 'NO_LLEGO', randomUUID());
    assert.equal(r.statusCode, 409, r.body);
    const [p] = await e.bd.consultar<{ estado: string }>('SELECT estado FROM pagos WHERE id = $1', [pago]);
    assert.equal(p.estado, 'VERIFICADO');
  });
});
