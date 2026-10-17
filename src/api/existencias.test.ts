// TICKET-21 · surtido y existencias (FR-25, RN-21): la administración anota lo que llega y el sistema descuenta lo vendido.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

const pedir = (method: 'GET' | 'POST', url: string, payload?: unknown, cookie = admin) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie } });
const idProducto = async (nombre: string) => (await e.bd.consultar<{ id: string }>('SELECT id FROM productos WHERE nombre = $1', [nombre]))[0].id;
const estadia211 = async () => (await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '211' AND estado = 'ACTIVA'`))[0].id;
interface Existencia { producto_id: string; nombre: string; grupo: string; surtido: number; vendido: number; existencias: number }
const existencias = async () => (await pedir('GET', '/existencias')).json().items as Existencia[];
const de = async (nombre: string) => (await existencias()).find((x) => x.nombre === nombre)!;

describe('FR-25 — Surtido', () => {
  it('la administración anota lo que llegó: 201 y queda en la auditoría con quién lo registró', async () => {
    const r = await pedir('POST', '/surtidos', { producto_id: await idProducto('Gatorade'), cantidad: 10 });
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().cantidad, 10);
    const [a] = await e.bd.consultar<{ usuario: string; detalle: Record<string, string> }>(
      `SELECT u.usuario, a.detalle FROM auditoria a JOIN usuarios u ON u.id = a.usuario_id WHERE a.entidad = 'surtidos' AND a.entidad_id = $1`, [r.json().id]);
    assert.deepEqual([a.usuario, a.detalle.cantidad], ['admin', '10']);
  });

  it('recepción no anota surtido ni ve existencias: 403', async () => {
    assert.equal((await pedir('POST', '/surtidos', { producto_id: await idProducto('Agua'), cantidad: 5 }, recepcion)).statusCode, 403);
    assert.equal((await pedir('GET', '/existencias', undefined, recepcion)).statusCode, 403);
  });

  it('cantidad 0 o negativa, o producto sin existencias (lavandería, llave): 400 o 422', async () => {
    assert.equal((await pedir('POST', '/surtidos', { producto_id: await idProducto('Agua'), cantidad: 0 })).statusCode, 400);
    const lavanderia = await pedir('POST', '/surtidos', { producto_id: await idProducto('Buso'), cantidad: 3 });
    assert.equal(lavanderia.statusCode, 422);
    assert.equal(lavanderia.json().codigo, 'SIN_EXISTENCIAS');
    assert.equal((await pedir('POST', '/surtidos', { producto_id: '00000000-0000-4000-8000-000000000000', cantidad: 3 })).statusCode, 404);
  });
});

describe('RN-21 — Existencias calculadas', () => {
  it('solo nevera y vitrinas tienen existencias; lavandería y otros no aparecen', async () => {
    const grupos = new Set((await existencias()).map((x) => x.grupo));
    assert.ok(grupos.has('NEVERA'));
    assert.ok(!grupos.has('LAVANDERIA') && !grupos.has('OTROS'));
  });

  it('surtir 10 y cargar 3 a una habitación deja 7; anular uno de esos cargos lo devuelve (8)', async () => {
    const gatorade = await idProducto('Gatorade');
    assert.deepEqual([(await de('Gatorade')).surtido, (await de('Gatorade')).existencias], [10, 10]);
    const r = await e.app.inject({
      method: 'POST', url: `/api/v1/estadias/${await estadia211()}/cargos`,
      payload: { items: [{ producto_id: gatorade, cantidad: 2 }, { producto_id: gatorade, cantidad: 1 }] }, headers: { cookie: recepcion },
    });
    assert.equal(r.statusCode, 201);
    assert.deepEqual([(await de('Gatorade')).vendido, (await de('Gatorade')).existencias], [3, 7]);
    // La anulación de cargos no tiene pantalla todavía: se marca en la base para comprobar que el cálculo la excluye.
    const [uno] = await e.bd.consultar<{ id: string }>(`SELECT id FROM cargos WHERE producto_id = $1 AND cantidad = 1`, [gatorade]);
    const [u] = await e.bd.consultar<{ id: string }>(`SELECT id FROM usuarios WHERE usuario = 'admin'`);
    await e.bd.consultar(`UPDATE cargos SET anulado_en = now(), anulado_por = $2, motivo_anulacion = 'Prueba de anulación' WHERE id = $1`, [uno.id, u.id]);
    assert.equal((await de('Gatorade')).existencias, 8);
  });

  it('lo vendido sin surtido deja existencias negativas (se avisa, no se bloquea la venta)', async () => {
    // La semilla ya cargó una Coca-Cola a la 211 sin surtido previo.
    const coca = await de('Coca-Cola');
    assert.deepEqual([coca.surtido, coca.vendido, coca.existencias], [0, 1, -1]);
  });
});
