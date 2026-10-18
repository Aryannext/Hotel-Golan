// TICKET-35 · informe de productos vendidos (FR-32; RN-15, RN-21): por turno, por día del hotel (6:30 a 6:30) y por
// semana o mes, sin contar productos en cada turno (administradora, HG-ACT-001 V5-20). Datos sintéticos.
// Semilla: la 211 tiene una Coca-Cola de $4.000 cargada el 13-10 a las 00:15 (día del hotel 12-10).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entornoConSesiones, type Entorno } from './pruebas/entorno.ts';

interface Producto { nombre: string; cantidad: number; valor: number }
interface Grupo { grupo: string; productos: Producto[]; cantidad: number; valor: number }
interface Informe { desde: string; hasta: string; turno_id: string | null; grupos: Grupo[]; cantidad: number; valor: number }

let e: Entorno;
let recepcion: string;
let admin: string;
let e205: string;
let pagoVenta: string;

const pedir = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown, cookie = admin) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie } });
const id = async (nombre: string) => (await e.bd.consultar<{ id: string }>('SELECT id FROM productos WHERE nombre = $1', [nombre]))[0].id;
const informe = async (q: string) => (await pedir('GET', `/reportes/productos?${q}`)).json() as Informe;
const del = (i: Informe, grupo: string, nombre: string) => i.grupos.find((g) => g.grupo === grupo)?.productos.find((p) => p.nombre === nombre);

before(async () => {
  ({ e, recepcion, admin, e205 } = await entornoConSesiones('2026-10-13T06:20:00-05:00'));
  // En el turno de noche abierto: 2 Agua cargadas a la 205, 1 Agua de contado y 1 buso de una persona de afuera.
  assert.equal((await pedir('POST', `/estadias/${e205}/cargos`, { items: [{ producto_id: await id('Agua'), cantidad: 2 }] }, recepcion)).statusCode, 201);
  const venta = await pedir('POST', '/ventas', { items: [{ producto_id: await id('Agua'), cantidad: 1 }], medio: 'EFECTIVO' }, recepcion);
  assert.equal(venta.statusCode, 201, venta.body);
  pagoVenta = venta.json().pago.id;
  const ropa = await pedir('POST', '/lavanderia', { cliente_nombre: 'Externo Prueba', items: [{ producto_id: await id('Buso'), cantidad: 1 }], cobro: { medio: 'EFECTIVO' } }, recepcion);
  assert.equal(ropa.statusCode, 201, ropa.body);
});
after(async () => e.cerrar());

describe('FR-32 (V5-20) — productos vendidos', () => {
  it('por día del hotel: cargados a habitaciones, de contado y la lavandería de afuera, por grupo y producto', async () => {
    const i = await informe('desde=2026-10-12&hasta=2026-10-12');
    assert.deepEqual(del(i, 'NEVERA', 'Agua'), { nombre: 'Agua', cantidad: 3, valor: 7500 });
    assert.deepEqual(del(i, 'NEVERA', 'Coca-Cola'), { nombre: 'Coca-Cola', cantidad: 1, valor: 4000 });
    assert.deepEqual(del(i, 'LAVANDERIA', 'Buso'), { nombre: 'Buso', cantidad: 1, valor: 2000 });
    assert.deepEqual([i.cantidad, i.valor], [5, 13500]);
    // El alojamiento, la llave o los descuentos no son productos.
    assert.ok(!i.grupos.some((g) => g.productos.some((p) => p.nombre.startsWith('Noche'))));
  });

  it('por turno: el turno de noche abierto tiene lo mismo', async () => {
    const i = await informe(`turno_id=${e.semilla.turnoId}`);
    assert.deepEqual([i.turno_id, i.cantidad, i.valor], [e.semilla.turnoId, 5, 13500]);
  });

  it('por semana o mes: un rango de días del hotel; un día sin ventas da cero', async () => {
    assert.equal((await informe('desde=2026-10-12&hasta=2026-10-18')).valor, 13500);
    const vacio = await informe('desde=2026-10-14&hasta=2026-10-14');
    assert.deepEqual([vacio.grupos.length, vacio.cantidad, vacio.valor], [0, 0, 0]);
  });

  it('cambiar el precio de un producto no altera lo ya vendido', async () => {
    const agua = await id('Agua');
    assert.equal((await pedir('PUT', `/productos/${agua}`, { nombre: 'Agua', grupo: 'NEVERA', precio: 3000, activo: true })).statusCode, 200);
    assert.equal(del(await informe('desde=2026-10-12&hasta=2026-10-12'), 'NEVERA', 'Agua')!.valor, 7500);
  });

  it('anular el pago de una venta de contado la quita del informe', async () => {
    assert.equal((await pedir('POST', `/pagos/${pagoVenta}/anulacion`, { motivo: 'Se registró dos veces' })).statusCode, 200);
    assert.deepEqual(del(await informe('desde=2026-10-12&hasta=2026-10-12'), 'NEVERA', 'Agua'), { nombre: 'Agua', cantidad: 2, valor: 5000 });
  });

  it('solo la administración (recepción: 403); rango al revés o sin rango ni turno: 400', async () => {
    assert.equal((await pedir('GET', '/reportes/productos?desde=2026-10-12&hasta=2026-10-12', undefined, recepcion)).statusCode, 403);
    assert.equal((await pedir('GET', '/reportes/productos?desde=2026-10-13&hasta=2026-10-12')).statusCode, 400);
    assert.equal((await pedir('GET', '/reportes/productos')).statusCode, 400);
  });
});
