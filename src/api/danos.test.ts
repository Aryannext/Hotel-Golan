// TICKET-27 · cobrar un daño (FR-06; RN-18, RN-07). El valor de reposición lo pone solo la administración: recepción la
// llama (administradora, HG-ACT-001 V5-06). Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
let admin: string;
let e205: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:15:00-05:00');
  recepcion = await e.entrar('recepcion2');
  admin = await e.entrar('admin');
  [{ id: e205 }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '205' AND estado = 'ACTIVA'`);
});
after(async () => e.cerrar());

const danar = (payload: unknown, cookie = admin, id = e205) =>
  e.app.inject({ method: 'POST', url: `/api/v1/estadias/${id}/danos`, payload: payload as object, headers: { cookie } });
const estadia = async () => (await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${e205}`, headers: { cookie: recepcion } })).json();

describe('RN-18 (V5-06) — daños con valor de reposición', () => {
  it('la administración carga «Toalla manchada» por $25.000: queda como cargo DANO con quién lo registró y sube el saldo', async () => {
    const antes = (await estadia()).cuenta.saldo as number;
    const r = await danar({ descripcion: 'Toalla manchada', valor: 25000 });
    assert.equal(r.statusCode, 201, r.body);
    const cargo = (r.json().cargos as Array<{ tipo: string; concepto: string; valor: number; creado_por: string }>).find((c) => c.tipo === 'DANO')!;
    assert.deepEqual([cargo.concepto, cargo.valor, cargo.creado_por], ['Daño: Toalla manchada', 25000, 'admin']);
    assert.equal(r.json().cuenta.saldo, antes + 25000);
  });

  it('recepción no pone el valor de un daño: 403', async () => {
    assert.equal((await danar({ descripcion: 'Vaso roto', valor: 5000 }, recepcion)).statusCode, 403);
  });

  it('sin descripción o con valor $0: 400', async () => {
    assert.equal((await danar({ descripcion: '', valor: 5000 })).statusCode, 400);
    assert.equal((await danar({ descripcion: 'Vaso roto', valor: 0 })).statusCode, 400);
  });

  it('con el daño sin pagar, la salida responde 409 SALDO_PENDIENTE (RN-07)', async () => {
    const r = await e.app.inject({ method: 'POST', url: `/api/v1/estadias/${e205}/salida`, headers: { cookie: recepcion } });
    assert.deepEqual([r.statusCode, r.json().codigo], [409, 'SALDO_PENDIENTE']);
  });

  it('a una estadía que ya terminó o no existe: 409 o 404', async () => {
    assert.equal((await danar({ descripcion: 'Vaso roto', valor: 5000 }, admin, '00000000-0000-4000-8000-000000000000')).statusCode, 404);
  });

  it('queda en la auditoría como daño, sin datos del huésped', async () => {
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE entidad = 'cargos' AND detalle->>'tipo' = 'DANO'`);
    assert.deepEqual([a.detalle.valor, a.detalle.estadia], ['25000', e205]);
  });
});
