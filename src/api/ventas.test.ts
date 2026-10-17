// TICKET-22 · venta de contado (FR-26; RN-20, RN-21, RN-10, RN-12): sin habitación, con efectivo o transferencia.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let admin: string;
let recepcion: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T05:00:00-05:00');
  admin = await e.entrar('admin');
  recepcion = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

const id = async (nombre: string) => (await e.bd.consultar<{ id: string }>('SELECT id FROM productos WHERE nombre = $1', [nombre]))[0].id;
const vender = async (cuerpo: Record<string, unknown>, clave?: string, cookie = recepcion) => e.app.inject({
  method: 'POST', url: '/api/v1/ventas', payload: cuerpo, headers: { cookie, ...(clave ? { 'idempotency-key': clave } : {}) },
});
const caja = async () => (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie: recepcion } })).json().caja;
const existencias = async (nombre: string) => ((await e.app.inject({ method: 'GET', url: '/api/v1/existencias', headers: { cookie: admin } })).json()
  .items as Array<{ nombre: string; vendido: number }>).find((x) => x.nombre === nombre)!;
interface PagoLista { id: string; venta_id: string | null; habitacion_numero: string | null; venta_detalle: string | null; estado: string; valor: number; anulado: boolean }
const pagosPorConfirmar = async () => (await e.app.inject({ method: 'GET', url: '/api/v1/pagos?estado=POR_VERIFICAR', headers: { cookie: admin } })).json().items as PagoLista[];

describe('FR-26 — Venta de contado en efectivo', () => {
  let ventaId: string;
  let pagoId: string;

  it('2 aguas y 1 Gatorade en efectivo: 201, $10.000, suma a la caja y descuenta existencias', async () => {
    const antes = await caja();
    const aguaAntes = (await existencias('Agua')).vendido;
    const r = await vender({ items: [{ producto_id: await id('Agua'), cantidad: 2 }, { producto_id: await id('Gatorade'), cantidad: 1 }], medio: 'EFECTIVO' });
    assert.equal(r.statusCode, 201);
    const v = r.json();
    ventaId = v.id;
    pagoId = v.pago.id;
    assert.equal(v.total, 10000);
    assert.deepEqual(v.items.map((x: { concepto: string; cantidad: number; valor: number }) => [x.concepto, x.cantidad, x.valor]), [['Agua', 2, 5000], ['Gatorade', 1, 5000]]);
    assert.deepEqual([v.pago.medio, v.pago.estado, v.pago.valor], ['EFECTIVO', 'EN_CAJA', 10000]);
    assert.equal((await caja()).debe_haber, antes.debe_haber + 10000);
    assert.equal((await existencias('Agua')).vendido, aguaAntes + 2);
  });

  it('el cobro aparece en los pagos del turno como venta de contado, sin habitación', async () => {
    const turno = (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie: recepcion } })).json();
    const pagos = (await e.app.inject({ method: 'GET', url: `/api/v1/pagos?turno_id=${turno.id}`, headers: { cookie: recepcion } })).json().items as PagoLista[];
    const p = pagos.find((x) => x.id === pagoId)!;
    assert.deepEqual([p.venta_id, p.habitacion_numero, p.venta_detalle], [ventaId, null, 'Agua × 2, Gatorade × 1']);
  });

  it('la administración la anula con motivo: la caja y las existencias se recalculan', async () => {
    const antes = await caja();
    const aguaAntes = (await existencias('Agua')).vendido;
    const r = await e.app.inject({ method: 'POST', url: `/api/v1/pagos/${pagoId}/anulacion`, payload: { motivo: 'Se registró dos veces' }, headers: { cookie: admin } });
    assert.equal(r.statusCode, 200);
    assert.equal((await caja()).debe_haber, antes.debe_haber - 10000);
    assert.equal((await existencias('Agua')).vendido, aguaAntes - 2);
  });

  it('con la misma Idempotency-Key, repetir no duplica la venta', async () => {
    const clave = randomUUID();
    const cuerpo = { items: [{ producto_id: await id('Hit'), cantidad: 1 }], medio: 'EFECTIVO' };
    const a = await vender(cuerpo, clave);
    const b = await vender(cuerpo, clave);
    assert.equal(a.statusCode, 201);
    assert.equal(b.json().id, a.json().id);
    const [n] = await e.bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM ventas WHERE id = $1', [a.json().id]);
    assert.equal(n.n, 1);
  });
});

describe('FR-26 — Venta de contado por transferencia (RN-12)', () => {
  it('por Nequi queda por confirmar, no suma a la caja y avisa a la administración', async () => {
    const antes = await caja();
    const r = await vender({ items: [{ producto_id: await id('Pony Malta'), cantidad: 2 }], medio: 'NEQUI' });
    assert.equal(r.statusCode, 201);
    assert.deepEqual([r.json().pago.estado, r.json().total], ['POR_VERIFICAR', 7000]);
    assert.equal((await caja()).debe_haber, antes.debe_haber);
    const p = (await pagosPorConfirmar()).find((x) => x.id === r.json().pago.id)!;
    assert.deepEqual([p.habitacion_numero, p.venta_detalle], [null, 'Pony Malta × 2']);
    const [ev] = await e.bd.consultar<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM eventos_salida WHERE tipo = 'pago.por_verificar' ORDER BY id DESC LIMIT 1`);
    assert.deepEqual([ev.payload.entidad_id, ev.payload.habitacion_numero, ev.payload.valor], [r.json().pago.id, null, 7000]);
    const v = await e.app.inject({ method: 'POST', url: `/api/v1/pagos/${r.json().pago.id}/verificacion`, payload: { resultado: 'LLEGO' }, headers: { cookie: admin } });
    assert.equal(v.statusCode, 200);
    assert.equal(v.json().estado, 'VERIFICADO');
  });
});

describe('FR-26 — Validaciones', () => {
  it('solo productos de la nevera y las vitrinas: lavandería o llave responden 422 NO_VENDIBLE', async () => {
    const r = await vender({ items: [{ producto_id: await id('Buso'), cantidad: 1 }], medio: 'EFECTIVO' });
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().codigo, 'NO_VENDIBLE');
  });

  it('un producto desactivado responde 409; uno que no existe, 404', async () => {
    await e.bd.consultar(`UPDATE productos SET activo = false WHERE nombre = 'Squash'`);
    assert.equal((await vender({ items: [{ producto_id: await id('Squash'), cantidad: 1 }], medio: 'EFECTIVO' })).statusCode, 409);
    assert.equal((await vender({ items: [{ producto_id: '00000000-0000-4000-8000-000000000000', cantidad: 1 }], medio: 'EFECTIVO' })).statusCode, 404);
  });

  it('sin productos, cantidad 0 o medio desconocido: 400; sin sesión: 401', async () => {
    assert.equal((await vender({ items: [], medio: 'EFECTIVO' })).statusCode, 400);
    assert.equal((await vender({ items: [{ producto_id: await id('Agua'), cantidad: 0 }], medio: 'EFECTIVO' })).statusCode, 400);
    assert.equal((await vender({ items: [{ producto_id: await id('Agua'), cantidad: 1 }], medio: 'TARJETA' })).statusCode, 400);
    const valido = { items: [{ producto_id: await id('Agua'), cantidad: 1 }], medio: 'EFECTIVO' };
    assert.equal((await e.app.inject({ method: 'POST', url: '/api/v1/ventas', payload: valido })).statusCode, 401);
  });
});
