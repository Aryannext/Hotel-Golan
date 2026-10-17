// TICKET-23 · lavandería para huéspedes (FR-27; RN-22, RN-07): pedido cargado a la habitación y entrega contra pago.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
let e205: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T05:00:00-05:00');
  recepcion = await e.entrar('recepcion2');
  [{ id: e205 }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '205' AND estado = 'ACTIVA'`);
});
after(async () => e.cerrar());

const pedir = (method: 'GET' | 'POST', url: string, payload?: unknown) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie: recepcion } });
const id = async (nombre: string) => (await e.bd.consultar<{ id: string }>('SELECT id FROM productos WHERE nombre = $1', [nombre]))[0].id;
const saldo205 = async () => (await pedir('GET', `/estadias/${e205}`)).json().cuenta.saldo as number;
const caja = async () => (await pedir('GET', '/turnos/actual')).json().caja;
interface Pedido { id: string; habitacion_numero: string; detalle: string; total: number; estado: string; entregado_por: string | null; sin_pago_autorizado_por: string | null }
const pendientes = async () => (await pedir('GET', '/lavanderia?estado=RECIBIDO')).json().items as Pedido[];

describe('FR-27 — Pedido de lavandería de un huésped', () => {
  let pedido: Pedido;

  it('2 busos y 1 pantalón para la 205: 201, $7.000, cargado a la cuenta y por entregar', async () => {
    const antes = await saldo205();
    const r = await pedir('POST', `/estadias/${e205}/lavanderia`, { items: [{ producto_id: await id('Buso'), cantidad: 2 }, { producto_id: await id('Pantalón'), cantidad: 1 }] });
    assert.equal(r.statusCode, 201);
    pedido = r.json();
    assert.deepEqual([pedido.habitacion_numero, pedido.detalle, pedido.total, pedido.estado], ['205', 'Buso × 2, Pantalón × 1', 7000, 'RECIBIDO']);
    assert.equal(await saldo205(), antes + 7000);
    const cargos = (await pedir('GET', `/estadias/${e205}`)).json().cargos as Array<{ concepto: string; cantidad: number; valor: number }>;
    assert.ok(cargos.some((c) => c.concepto === 'Lavandería: Buso' && c.cantidad === 2 && c.valor === 4000));
    assert.ok((await pendientes()).some((p) => p.id === pedido.id));
  });

  it('sin pagar y sin autorización no se entrega: 422 PAGO_REQUERIDO', async () => {
    const r = await pedir('POST', `/lavanderia/${pedido.id}/entrega`, {});
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().codigo, 'PAGO_REQUERIDO');
    assert.ok((await pendientes()).some((p) => p.id === pedido.id));
  });

  it('al entregar cobrando en efectivo: queda pagado, entra a la caja y sale de los pendientes', async () => {
    const cajaAntes = await caja();
    const r = await pedir('POST', `/lavanderia/${pedido.id}/entrega`, { cobro: { medio: 'EFECTIVO' } });
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().estado, r.json().entregado_por, r.json().sin_pago_autorizado_por], ['ENTREGADO', 'recepcion2', null]);
    assert.equal(await saldo205(), 0);
    assert.equal((await caja()).debe_haber, cajaAntes.debe_haber + 7000);
    assert.ok(!(await pendientes()).some((p) => p.id === pedido.id));
  });

  it('un pedido ya entregado no se entrega otra vez: 409', async () => {
    assert.equal((await pedir('POST', `/lavanderia/${pedido.id}/entrega`, { cobro: { medio: 'EFECTIVO' } })).statusCode, 409);
  });
});

describe('RN-22 — Entrega sin pago autorizada por recepción', () => {
  it('se entrega con la autorización registrada; la deuda sigue y la salida queda bloqueada (RN-07)', async () => {
    const r = await pedir('POST', `/estadias/${e205}/lavanderia`, { items: [{ producto_id: await id('Cobija'), cantidad: 1 }] });
    const entrega = await pedir('POST', `/lavanderia/${r.json().id}/entrega`, { sin_pago_autorizado: true });
    assert.equal(entrega.statusCode, 200);
    assert.deepEqual([entrega.json().estado, entrega.json().sin_pago_autorizado_por], ['ENTREGADO', 'recepcion2']);
    assert.equal(await saldo205(), 5000);
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE entidad = 'pedidos_lavanderia' AND entidad_id = $1 AND accion = 'ACTUALIZAR'`, [r.json().id]);
    assert.equal(a.detalle.sin_pago, 'autorizado');
    const salida = await pedir('POST', `/estadias/${e205}/salida`);
    assert.equal(salida.statusCode, 409);
    assert.equal(salida.json().codigo, 'SALDO_PENDIENTE');
  });

  it('si la cuenta ya está en $0 (pagó antes), se entrega sin cobrar de nuevo', async () => {
    await pedir('POST', `/estadias/${e205}/pagos`, { medio: 'EFECTIVO', valor: 5000 });
    const r = await pedir('POST', `/estadias/${e205}/lavanderia`, { items: [{ producto_id: await id('Toalla'), cantidad: 1 }] });
    await pedir('POST', `/estadias/${e205}/pagos`, { medio: 'NEQUI', valor: 3000 });
    const entrega = await pedir('POST', `/lavanderia/${r.json().id}/entrega`, {});
    assert.equal(entrega.statusCode, 200);
    assert.equal(entrega.json().sin_pago_autorizado_por, null);
  });
});

describe('FR-27 — Validaciones', () => {
  it('solo prendas de lavandería: 422 NO_VENDIBLE; estadía que no existe: 404; sin prendas: 400', async () => {
    const agua = await pedir('POST', `/estadias/${e205}/lavanderia`, { items: [{ producto_id: await id('Agua'), cantidad: 1 }] });
    assert.equal(agua.statusCode, 422);
    assert.equal(agua.json().codigo, 'NO_VENDIBLE');
    assert.equal((await pedir('POST', '/estadias/00000000-0000-4000-8000-000000000000/lavanderia', { items: [{ producto_id: await id('Buso'), cantidad: 1 }] })).statusCode, 404);
    assert.equal((await pedir('POST', `/estadias/${e205}/lavanderia`, { items: [] })).statusCode, 400);
  });

  it('en «Agregar cargos» ya no se cargan prendas sueltas: la lavandería va como pedido (409)', async () => {
    const r = await e.app.inject({ method: 'POST', url: `/api/v1/estadias/${e205}/cargos`, payload: { items: [{ producto_id: await id('Buso'), cantidad: 1 }] }, headers: { cookie: recepcion } });
    assert.equal(r.statusCode, 409);
  });
});
