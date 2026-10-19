// TICKET-28 · datos del hotel para el aviso de privacidad (FR-05; RN-16; ADR-006): responsable, NIT, Registro Nacional de
// Turismo, dirección y teléfono. No van en el código (el repositorio es público): la administración los escribe en Ajustes.
// Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entornoConSesiones, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
let admin: string;
const pedir = (method: 'GET' | 'PUT', payload?: unknown, cookie: string | null = admin) =>
  e.app.inject({ method, url: '/api/v1/hotel', payload: payload as object, headers: cookie ? { cookie } : {} });
const datos = { responsable: 'Responsable Prueba', nit: '12.345.678-9', rnt: '12345', direccion: 'Calle Prueba # 1-23', telefono: '3001234567' };

before(async () => { ({ e, recepcion, admin } = await entornoConSesiones('2026-10-13T06:20:00-05:00')); });
after(async () => e.cerrar());

describe('TICKET-28 — datos del hotel para el aviso', () => {
  it('al empezar no hay datos: todos en null (la pantalla avisa qué falta)', async () => {
    const r = await pedir('GET', undefined, recepcion);
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json(), { responsable: null, nit: null, rnt: null, direccion: null, telefono: null });
  });

  it('la administración los guarda; recepción los lee para mostrar el aviso', async () => {
    const r = await pedir('PUT', datos);
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json(), datos);
    assert.deepEqual((await pedir('GET', undefined, recepcion)).json(), datos);
  });

  it('queda en la auditoría qué campos cambiaron, sin los valores', async () => {
    assert.equal((await pedir('PUT', { ...datos, telefono: '3007654321' })).statusCode, 200);
    const filas = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE entidad = 'datos_hotel' ORDER BY id`);
    assert.deepEqual(filas.at(-1)!.detalle, { campos: 'telefono' });
    assert.ok(!JSON.stringify(filas).includes('12.345.678-9'));
  });

  it('un campo vacío se guarda como null', async () => {
    assert.equal((await pedir('PUT', { ...datos, direccion: '  ' })).json().direccion, null);
  });

  it('recepción no los cambia (403); sin sesión, 401; un teléfono o un RNT mal escrito, 400', async () => {
    assert.equal((await pedir('PUT', datos, recepcion)).statusCode, 403);
    assert.equal((await pedir('GET', undefined, null)).statusCode, 401);
    assert.equal((await pedir('PUT', { ...datos, telefono: '12' })).statusCode, 400);
    assert.equal((await pedir('PUT', { ...datos, rnt: 'ABC' })).statusCode, 400);
  });
});
