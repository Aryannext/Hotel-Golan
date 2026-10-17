// TICKET-24 · lavandería para externos (FR-27; RN-22, RN-20): solo el nombre, paga por adelantado o al reclamar.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';
import { anonimizarVencidos } from './privacidad/anonimizacion.ts';

let e: Entorno;
let recepcion: string;
let admin: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T05:00:00-05:00');
  recepcion = await e.entrar('recepcion2');
  admin = await e.entrar('admin');
});
after(async () => e.cerrar());

const pedir = (method: 'GET' | 'POST', url: string, payload?: unknown, cookie = recepcion) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie } });
const id = async (nombre: string) => (await e.bd.consultar<{ id: string }>('SELECT id FROM productos WHERE nombre = $1', [nombre]))[0].id;
const caja = async () => (await pedir('GET', '/turnos/actual')).json().caja;
interface Pedido { id: string; habitacion_numero: string | null; cliente_nombre: string | null; total: number; estado: string; por_cobrar: number | null; sin_pago_autorizado_por: string | null }
const deudas = async (cookie = admin) => (await pedir('GET', '/lavanderia/deudas', undefined, cookie)).json().items as Pedido[];

describe('FR-27 — Pedido de un externo', () => {
  it('2 sábanas de «Cliente Externo Prueba»: 201, $8.000 por cobrar, sin habitación ni cargos', async () => {
    const cargosAntes = (await e.bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM cargos'))[0].n;
    const r = await pedir('POST', '/lavanderia', { cliente_nombre: 'Cliente Externo Prueba', items: [{ producto_id: await id('Sábana'), cantidad: 2 }] });
    assert.equal(r.statusCode, 201);
    const p: Pedido = r.json();
    assert.deepEqual([p.habitacion_numero, p.cliente_nombre, p.total, p.estado, p.por_cobrar], [null, 'Cliente Externo Prueba', 8000, 'RECIBIDO', 8000]);
    assert.equal((await e.bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM cargos'))[0].n, cargosAntes);
  });

  it('pagado por adelantado en efectivo: suma a la caja, no debe nada y se entrega sin cobrar de nuevo', async () => {
    const antes = await caja();
    const r = await pedir('POST', '/lavanderia', { cliente_nombre: 'Otro Externo Prueba', items: [{ producto_id: await id('Toalla'), cantidad: 1 }], cobro: { medio: 'EFECTIVO' } });
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().por_cobrar, 0);
    assert.equal((await caja()).debe_haber, antes.debe_haber + 3000);
    const turno = (await pedir('GET', '/turnos/actual')).json();
    const pagos = (await pedir('GET', `/pagos?turno_id=${turno.id}`)).json().items as Array<{ valor: number; lavanderia_cliente: string | null; habitacion_numero: string | null }>;
    assert.ok(pagos.some((x) => x.lavanderia_cliente === 'Otro Externo Prueba' && x.valor === 3000 && x.habitacion_numero === null));
    const entrega = await pedir('POST', `/lavanderia/${r.json().id}/entrega`, {});
    assert.equal(entrega.statusCode, 200);
    assert.equal(entrega.json().sin_pago_autorizado_por, null);
  });

  it('sin pagar no se entrega; con autorización queda como deuda a su nombre y con quien autorizó', async () => {
    const r = await pedir('POST', '/lavanderia', { cliente_nombre: 'Deudor Externo Prueba', items: [{ producto_id: await id('Cobija'), cantidad: 1 }] });
    assert.equal((await pedir('POST', `/lavanderia/${r.json().id}/entrega`, {})).json().codigo, 'PAGO_REQUERIDO');
    const entrega = await pedir('POST', `/lavanderia/${r.json().id}/entrega`, { sin_pago_autorizado: true });
    assert.equal(entrega.statusCode, 200);
    assert.deepEqual([entrega.json().estado, entrega.json().sin_pago_autorizado_por, entrega.json().por_cobrar], ['ENTREGADO', 'recepcion2', 5000]);
    const d = (await deudas()).find((x) => x.id === r.json().id)!;
    assert.deepEqual([d.cliente_nombre, d.por_cobrar, d.sin_pago_autorizado_por], ['Deudor Externo Prueba', 5000, 'recepcion2']);
  });

  it('cuando vuelve y paga (por Nequi), la deuda sale de la lista', async () => {
    const [d] = (await deudas()).filter((x) => x.cliente_nombre === 'Deudor Externo Prueba');
    const r = await pedir('POST', `/lavanderia/${d.id}/cobro`, { medio: 'NEQUI' });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().por_cobrar, 0);
    assert.ok(!(await deudas()).some((x) => x.id === d.id));
    assert.equal((await pedir('POST', `/lavanderia/${d.id}/cobro`, { medio: 'EFECTIVO' })).statusCode, 409);
  });
});

describe('FR-27 — Validaciones y privacidad de externos', () => {
  it('sin nombre o con un nombre de una letra: 400', async () => {
    const items = [{ producto_id: await id('Buso'), cantidad: 1 }];
    assert.equal((await pedir('POST', '/lavanderia', { items })).statusCode, 400);
    assert.equal((await pedir('POST', '/lavanderia', { cliente_nombre: 'A', items })).statusCode, 400);
  });

  it('el nombre del externo se borra con la anonimización, 90 días después de entregar', async () => {
    const [p] = await e.bd.consultar<{ id: string }>(`SELECT id FROM pedidos_lavanderia WHERE cliente_nombre = 'Deudor Externo Prueba'`);
    await e.bd.consultar(`UPDATE pedidos_lavanderia SET entregado_en = '2026-07-01T10:00:00-05:00' WHERE id = $1`, [p.id]);
    await anonimizarVencidos(e.bd, new Date('2026-10-13T06:00:00-05:00'));
    const [f] = await e.bd.consultar<{ cliente_nombre: string; anonimizado_en: Date | null }>('SELECT cliente_nombre, anonimizado_en FROM pedidos_lavanderia WHERE id = $1', [p.id]);
    assert.equal(f.cliente_nombre, 'Externo anonimizado');
    assert.ok(f.anonimizado_en);
    const [reciente] = await e.bd.consultar<{ cliente_nombre: string }>(`SELECT cliente_nombre FROM pedidos_lavanderia WHERE cliente_nombre = 'Otro Externo Prueba'`);
    assert.ok(reciente, 'lo entregado hace menos de 90 días conserva el nombre');
  });
});
