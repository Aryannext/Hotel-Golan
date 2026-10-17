// TICKET-06 · GET /productos, POST /estadias/{id}/cargos y POST /estadias/{id}/pagos (FR-06, FR-07; RN-06, RN-14, RN-18).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
let e211: string;
let producto: Record<string, string>;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:20:00-05:00');
  cookie = await e.entrar('recepcion2');
  [{ id: e211 }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '211' AND estado = 'ACTIVA'`);
  producto = Object.fromEntries((await e.bd.consultar<{ nombre: string; id: string }>('SELECT nombre, id FROM productos')).map((p) => [p.nombre, p.id]));
});
after(async () => e.cerrar());

const cargar = (estadia: string, items: unknown[], clave?: string) => e.app.inject({
  method: 'POST', url: `/api/v1/estadias/${estadia}/cargos`, payload: { items }, headers: { cookie, ...(clave ? { 'idempotency-key': clave } : {}) },
});
const pagar = (estadia: string, medio: string, valor: number, clave?: string, c = cookie) => e.app.inject({
  method: 'POST', url: `/api/v1/estadias/${estadia}/pagos`, payload: { medio, valor }, headers: { cookie: c, ...(clave ? { 'idempotency-key': clave } : {}) },
});
const detalle = async (id = e211) => (await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${id}`, headers: { cookie } })).json();
const cuenta = async (id = e211) => (await detalle(id)).cuenta;
const caja = async () => (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie } })).json().caja;

describe('FR-06 — Catálogo de productos para cargos', () => {
  it('GET /productos lista los activos con el contrato Producto', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/productos', headers: { cookie } });
    assert.equal(r.statusCode, 200);
    const items = r.json().items as Array<Record<string, unknown>>;
    assert.equal(items.length, 15);
    assert.deepEqual(items.find((p) => p.nombre === 'Coca-Cola'),
      { id: producto['Coca-Cola'], nombre: 'Coca-Cola', grupo: 'NEVERA', precio: 4000, seccion: null, pertenece_a: 'HOTEL', activo: true });
    assert.equal(items.find((p) => p.nombre === 'Llave perdida')?.precio, 40000);
  });

  it('un producto inactivo no aparece en el catálogo', async () => {
    await e.bd.consultar(`UPDATE productos SET activo = false WHERE nombre = 'Squash'`);
    const items = (await e.app.inject({ method: 'GET', url: '/api/v1/productos', headers: { cookie } })).json().items;
    assert.ok(!items.some((p: { nombre: string }) => p.nombre === 'Squash'));
  });
});

describe('FR-06, RN-18, RN-14 — Cargos a la cuenta', () => {
  it('la cuenta de la 211 de la semilla: saldo $28.000 con $30.000 por verificar', async () => {
    assert.deepEqual(await cuenta(), { total_cargos: 84000, pagado: 26000, por_verificar: 30000, saldo: 28000, a_favor: 0 });
  });

  it('varios productos con cantidad y la llave perdida: cada cargo guarda precio unitario y cantidad', async () => {
    const idsAntes = new Set<string>((await detalle()).cargos.map((c: { id: string }) => c.id));
    const r = await cargar(e211, [{ producto_id: producto['Coca-Cola'], cantidad: 2 }, { producto_id: producto['Llave perdida'], cantidad: 1 }]);
    assert.equal(r.statusCode, 201);
    // Con la misma hora de creación, SQL no garantiza el orden entre cargos.
    const nuevos = r.json().cargos
      .filter((c: { id: string }) => !idsAntes.has(c.id))
      .sort((a: { concepto: string }, b: { concepto: string }) => a.concepto.localeCompare(b.concepto))
      .map((c: Record<string, unknown>) => [c.tipo, c.concepto, c.cantidad, c.valor_unitario, c.valor, c.creado_por]);
    assert.deepEqual(nuevos, [['PRODUCTO', 'Coca-Cola', 2, 4000, 8000, 'recepcion2'], ['LLAVE', 'Llave perdida', 1, 40000, 40000, 'recepcion2']]);
    assert.deepEqual(r.json().cuenta, { total_cargos: 132000, pagado: 26000, por_verificar: 30000, saldo: 76000, a_favor: 0 });
  });

  it('un cambio de precio posterior no altera los cargos ya hechos', async () => {
    await e.bd.consultar(`UPDATE productos SET precio = 5000 WHERE nombre = 'Coca-Cola'`);
    const r = await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${e211}`, headers: { cookie } });
    const coca = r.json().cargos.filter((c: { concepto: string; cantidad: number }) => c.concepto === 'Coca-Cola' && c.cantidad === 2);
    assert.deepEqual(coca.map((c: { valor_unitario: number; valor: number }) => [c.valor_unitario, c.valor]), [[4000, 8000]]);
  });

  it('el recargo de aseo extremo queda como cargo RECARGO_ASEO de $20.000 y se audita', async () => {
    const antes = await detalle();
    const idsAntes = new Set<string>(antes.cargos.map((c: { id: string }) => c.id));
    const r = await cargar(e211, [{ producto_id: producto['Recargo aseo extremo'], cantidad: 1 }]);
    assert.equal(r.statusCode, 201);
    const nuevos = r.json().cargos.filter((c: { id: string }) => !idsAntes.has(c.id));
    assert.equal(nuevos.length, 1);
    const [recargo] = nuevos;
    assert.deepEqual([recargo.tipo, recargo.valor], ['RECARGO_ASEO', 20000]);
    assert.equal(r.json().cuenta.saldo, antes.cuenta.saldo + 20000);
    const [a] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM auditoria WHERE accion = 'CREAR' AND entidad = 'cargos' AND entidad_id = $1`, [recargo.id]);
    assert.equal(a.n, 1);
  });

  it('producto inactivo: 409; producto o estadía que no existen: 404', async () => {
    assert.equal((await cargar(e211, [{ producto_id: producto.Squash, cantidad: 1 }])).statusCode, 409);
    assert.equal((await cargar(e211, [{ producto_id: '00000000-0000-4000-8000-000000000000', cantidad: 1 }])).statusCode, 404);
    assert.equal((await cargar('00000000-0000-4000-8000-000000000000', [{ producto_id: producto.Agua, cantidad: 1 }])).statusCode, 404);
  });

  it('cantidades fuera de 1 a 20 o lista vacía: 400', async () => {
    assert.equal((await cargar(e211, [{ producto_id: producto.Agua, cantidad: 0 }])).statusCode, 400);
    assert.equal((await cargar(e211, [{ producto_id: producto.Agua, cantidad: 21 }])).statusCode, 400);
    assert.equal((await cargar(e211, [])).statusCode, 400);
  });

  it('a una estadía cerrada no se le cargan consumos: 409', async () => {
    const [cerrada] = await e.bd.consultar<{ id: string }>(
      `UPDATE estadias SET estado = 'CERRADA', salida_real_en = now() WHERE habitacion_numero = '205' AND estado = 'ACTIVA' RETURNING id`);
    const r = await cargar(cerrada.id, [{ producto_id: producto.Agua, cantidad: 1 }]);
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().codigo, 'CONFLICTO');
    assert.equal((await pagar(cerrada.id, 'EFECTIVO', 1000)).statusCode, 409);
  });

  it('con Idempotency-Key, repetir no duplica los cargos', async () => {
    const antes = await cuenta();
    const clave = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';
    const a = await cargar(e211, [{ producto_id: producto.Agua, cantidad: 3 }], clave);
    const b = await cargar(e211, [{ producto_id: producto.Agua, cantidad: 3 }], clave);
    assert.deepEqual([a.statusCode, b.statusCode], [201, 201]);
    assert.equal((await cuenta()).saldo, antes.saldo + 7500);
  });
});

describe('FR-07, RN-06 — Pagos y abonos a la cuenta', () => {
  it('un abono en efectivo entra a la caja del turno y baja el saldo', async () => {
    const antes = await cuenta();
    const cajaAntes = await caja();
    const r = await pagar(e211, 'EFECTIVO', 20000);
    assert.equal(r.statusCode, 201);
    assert.deepEqual([r.json().medio, r.json().valor, r.json().estado, r.json().registrado_por, r.json().turno_id, r.json().habitacion_numero, r.json().estadia_id],
      ['EFECTIVO', 20000, 'EN_CAJA', 'recepcion2', e.semilla.turnoId, '211', e211]);
    assert.equal(r.json().registrado_en, '2026-10-13T06:20:00-05:00');
    const despues = await cuenta();
    assert.deepEqual([despues.pagado, despues.saldo], [antes.pagado + 20000, antes.saldo - 20000]);
    assert.equal((await caja()).debe_haber, cajaAntes.debe_haber + 20000);
  });

  it('un pago por Nequi queda POR_VERIFICAR: baja el saldo, no entra a la caja y avisa a la administración', async () => {
    const antes = await cuenta();
    const cajaAntes = await caja();
    const r = await pagar(e211, 'NEQUI', 8000);
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().estado, 'POR_VERIFICAR');
    const despues = await cuenta();
    assert.deepEqual([despues.por_verificar, despues.saldo], [antes.por_verificar + 8000, antes.saldo - 8000]);
    assert.equal((await caja()).debe_haber, cajaAntes.debe_haber);
    const [ev] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM eventos_salida WHERE tipo = 'pago.por_verificar' AND payload->>'entidad_id' = $1`, [r.json().id]);
    assert.equal(ev.n, 1);
  });

  it('no se cobra más que el saldo: 409; valor cero: 400', async () => {
    const { saldo } = await cuenta();
    const r = await pagar(e211, 'EFECTIVO', saldo + 1);
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().codigo, 'CONFLICTO');
    assert.equal((await pagar(e211, 'EFECTIVO', 0)).statusCode, 400);
  });

  it('con Idempotency-Key, un doble toque registra un solo pago', async () => {
    const antes = await cuenta();
    const clave = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e';
    const a = await pagar(e211, 'EFECTIVO', 1000, clave);
    const b = await pagar(e211, 'EFECTIVO', 1000, clave);
    assert.equal(b.json().id, a.json().id);
    assert.equal((await cuenta()).saldo, antes.saldo - 1000);
  });

  it('pagar todo el saldo deja la cuenta en cero', async () => {
    const { saldo } = await cuenta();
    assert.equal((await pagar(e211, 'BANCOLOMBIA', saldo)).statusCode, 201);
    assert.equal((await cuenta()).saldo, 0);
    assert.equal((await pagar(e211, 'EFECTIVO', 1)).statusCode, 409);
  });
});

describe('RN-09 — Sin turno abierto no se reciben pagos', () => {
  it('pagos: 409 SIN_TURNO_ABIERTO', async () => {
    const otro = await crearEntorno();
    try {
      await otro.bd.consultar(`UPDATE turnos SET estado = 'CERRADO', fin_en = now(), pago_tomado = true, efectivo_esperado = 0, efectivo_contado = 0`);
      const [s] = await otro.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '211'`);
      const r = await otro.app.inject({
        method: 'POST', url: `/api/v1/estadias/${s.id}/pagos`, payload: { medio: 'EFECTIVO', valor: 1000 }, headers: { cookie: await otro.entrar('recepcion1') },
      });
      assert.equal(r.statusCode, 409);
      assert.equal(r.json().codigo, 'SIN_TURNO_ABIERTO');
    } finally {
      await otro.cerrar();
    }
  });
});
