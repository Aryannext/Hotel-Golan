// TICKET-10 · GET y POST /movimientos_caja (FR-12; RN-10, RN-14) según docs/CONTRATO_API.yaml.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T05:28:00-05:00');
  cookie = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

// Cada intento ocurre un minuto después del anterior (tras el 401, la compra queda a las 5:30 a. m.), como en un turno real.
const registrar = (payload: Record<string, unknown>, c: string | null = cookie, clave?: string) => {
  e.avanzarMinutos(1);
  return e.app.inject({
    method: 'POST', url: '/api/v1/movimientos_caja', payload, headers: { ...(c ? { cookie: c } : {}), ...(clave ? { 'idempotency-key': clave } : {}) },
  });
};
const caja = async () => (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie } })).json().caja;

describe('FR-12, RN-10 — Una salida de dinero baja la caja, pero no cuenta como venta', () => {
  it('sin sesión: 401', async () => {
    assert.equal((await registrar({ tipo: 'COMPRA_HOTEL', detalle: '2 jabones', valor: 10000 }, null)).statusCode, 401);
  });

  it('compra para el hotel de $10.000: «debe haber» pasa de 234.500 a 224.500 y el efectivo cobrado sigue en 26.000', async () => {
    const r = await registrar({ tipo: 'COMPRA_HOTEL', detalle: '2 jabones', valor: 10000 });
    assert.equal(r.statusCode, 201);
    assert.deepEqual(r.json(), {
      id: r.json().id, turno_id: e.semilla.turnoId, tipo: 'COMPRA_HOTEL', detalle: '2 jabones', valor: 10000,
      habitacion_numero: null, registrado_por: 'recepcion2', registrado_en: '2026-10-13T05:30:00-05:00', anulado: false,
    });
    assert.deepEqual(await caja(), {
      base_recibida: 208500, efectivo: 26000, salidas: 10000, debe_haber: 224500, transferencias: 85000, por_verificar_cantidad: 1, pago_turno: 50000,
    });
    const [a] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM auditoria WHERE accion = 'CREAR' AND entidad = 'movimientos_caja' AND entidad_id = $1`, [r.json().id]);
    assert.equal(a.n, 1);
    const [ev] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM eventos_salida WHERE tipo = 'caja.movimiento' AND payload->>'entidad_id' = $1`, [r.json().id]);
    assert.equal(ev.n, 1);
  });

  it('el recargo de aseo entregado a quien limpió (RN-14) lleva la habitación', async () => {
    const r = await registrar({ tipo: 'RECARGO_ASEO', detalle: 'Limpieza extrema', valor: 20000, habitacion_numero: '207' });
    assert.equal(r.statusCode, 201);
    assert.deepEqual([r.json().tipo, r.json().habitacion_numero], ['RECARGO_ASEO', '207']);
    assert.equal((await registrar({ tipo: 'RECARGO_ASEO', detalle: 'Limpieza extrema', valor: 20000 })).statusCode, 400);
    assert.equal((await caja()).debe_haber, 204500);
  });

  it('la administración también registra salidas (retiro de la administración)', async () => {
    const r = await registrar({ tipo: 'RETIRO_ADMINISTRACION', detalle: 'Para pagar servicios', valor: 50000 }, await e.entrar('admin'));
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().registrado_por, 'admin');
  });

  it('una devolución no se crea desde aquí; valor cero, detalle corto o campos de más: 400', async () => {
    assert.equal((await registrar({ tipo: 'DEVOLUCION', detalle: 'Solo miró', valor: 1000 })).statusCode, 400);
    assert.equal((await registrar({ tipo: 'OTRO', detalle: 'Varios', valor: 0 })).statusCode, 400);
    assert.equal((await registrar({ tipo: 'OTRO', detalle: 'ab', valor: 1000 })).statusCode, 400);
    assert.equal((await registrar({ tipo: 'OTRO', detalle: 'Varios', valor: 1000, turno_id: e.semilla.turnoId })).statusCode, 400);
  });

  it('con Idempotency-Key, un doble toque registra una sola salida', async () => {
    const antes = await caja();
    const clave = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
    const a = await registrar({ tipo: 'OTRO', detalle: 'Pilas para el control', valor: 3000 }, cookie, clave);
    const b = await registrar({ tipo: 'OTRO', detalle: 'Pilas para el control', valor: 3000 }, cookie, clave);
    assert.equal(b.json().id, a.json().id);
    assert.equal((await caja()).debe_haber, antes.debe_haber - 3000);
  });

  it('GET /movimientos_caja lista las salidas del turno activo en orden; también con turno_id', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/movimientos_caja', headers: { cookie } });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json().items.map((m: { tipo: string; valor: number }) => [m.tipo, m.valor]),
      [['COMPRA_HOTEL', 10000], ['RECARGO_ASEO', 20000], ['RETIRO_ADMINISTRACION', 50000], ['OTRO', 3000]]);
    const f = await e.app.inject({ method: 'GET', url: `/api/v1/movimientos_caja?turno_id=${e.semilla.turnoId}`, headers: { cookie } });
    assert.equal(f.json().items.length, 4);
    const otro = await e.app.inject({ method: 'GET', url: '/api/v1/movimientos_caja?turno_id=00000000-0000-4000-8000-000000000000', headers: { cookie } });
    assert.deepEqual(otro.json().items, []);
  });
});

describe('RN-09 — Sin turno abierto no sale dinero', () => {
  it('409 SIN_TURNO_ABIERTO', async () => {
    const otro = await crearEntorno();
    try {
      await otro.bd.consultar(`UPDATE turnos SET estado = 'CERRADO', fin_en = now(), pago_tomado = true, efectivo_esperado = 0, efectivo_contado = 0`);
      const r = await otro.app.inject({
        method: 'POST', url: '/api/v1/movimientos_caja', payload: { tipo: 'COMPRA_HOTEL', detalle: '2 jabones', valor: 10000 },
        headers: { cookie: await otro.entrar('recepcion1') },
      });
      assert.equal(r.statusCode, 409);
      assert.equal(r.json().codigo, 'SIN_TURNO_ABIERTO');
    } finally {
      await otro.cerrar();
    }
  });
});
