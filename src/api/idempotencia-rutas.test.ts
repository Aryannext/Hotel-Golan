// HG-HAL-001 HAL-08 · la pantalla dice «Intente de nuevo: no se duplicará»: estas rutas también aceptan Idempotency-Key
// (ADR-011 Inbox). Repetir el envío con la misma clave devuelve la misma respuesta y no crea nada nuevo.
// HAL-04 · las claves guardadas se purgan a los 30 días (ADR-011): la respuesta puede llevar el nombre del huésped.
// Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';
import { purgarSolicitudesVencidas } from './privacidad/anonimizacion.ts';

let e: Entorno;
let recepcion: string;
let admin: string;
let e205: string;

const pedir = (url: string, payload: unknown, clave: string, cookie = recepcion) =>
  e.app.inject({ method: 'POST', url: `/api/v1${url}`, payload: payload as object, headers: { cookie, 'idempotency-key': clave } });
const dosVeces = async (url: string, payload: unknown, cookie = recepcion) => {
  const clave = randomUUID();
  const primera = await pedir(url, payload, clave, cookie);
  const segunda = await pedir(url, payload, clave, cookie);
  return { primera, segunda };
};
const contar = async (sql: string, params: unknown[] = []) => (await e.bd.consultar<{ n: number }>(sql, params))[0].n;
const id = async (nombre: string) => (await e.bd.consultar<{ id: string }>('SELECT id FROM productos WHERE nombre = $1', [nombre]))[0].id;
const iguales = (r: { primera: { statusCode: number; body: string }; segunda: { statusCode: number; body: string } }, estado: number) => {
  assert.equal(r.primera.statusCode, estado, r.primera.body);
  assert.equal(r.segunda.statusCode, estado, r.segunda.body);
  assert.deepEqual(JSON.parse(r.segunda.body), JSON.parse(r.primera.body));
};

before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T15:00:00-05:00');
  recepcion = await e.entrar('recepcion2');
  admin = await e.entrar('admin');
  [{ id: e205 }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '205' AND estado = 'ACTIVA'`);
});
after(async () => e.cerrar());

describe('HAL-08 — un doble envío con la misma clave no duplica', () => {
  it('daño: un solo cargo DANO', async () => {
    const antes = await contar(`SELECT count(*)::int AS n FROM cargos WHERE tipo = 'DANO'`);
    iguales(await dosVeces(`/estadias/${e205}/danos`, { descripcion: 'Vaso roto', valor: 5000 }, admin), 201);
    assert.equal(await contar(`SELECT count(*)::int AS n FROM cargos WHERE tipo = 'DANO'`), antes + 1);
  });

  it('lavandería del huésped: un solo pedido cargado a la cuenta', async () => {
    const antes = await contar('SELECT count(*)::int AS n FROM pedidos_lavanderia');
    iguales(await dosVeces(`/estadias/${e205}/lavanderia`, { items: [{ producto_id: await id('Buso'), cantidad: 1 }] }), 201);
    assert.equal(await contar('SELECT count(*)::int AS n FROM pedidos_lavanderia'), antes + 1);
  });

  it('lavandería de afuera cobrada de una vez: un solo pedido y un solo pago', async () => {
    const pedidos = await contar('SELECT count(*)::int AS n FROM pedidos_lavanderia');
    const pagos = await contar('SELECT count(*)::int AS n FROM pagos');
    iguales(await dosVeces('/lavanderia', { cliente_nombre: 'Cliente Prueba', items: [{ producto_id: await id('Toalla'), cantidad: 1 }], cobro: { medio: 'EFECTIVO' } }), 201);
    assert.equal(await contar('SELECT count(*)::int AS n FROM pedidos_lavanderia'), pedidos + 1);
    assert.equal(await contar('SELECT count(*)::int AS n FROM pagos'), pagos + 1);
  });

  it('cobro y entrega de lavandería de afuera: el reintento devuelve lo mismo, no «ya está pagado»', async () => {
    const p = await pedir('/lavanderia', { cliente_nombre: 'Cliente Prueba', items: [{ producto_id: await id('Sábana'), cantidad: 1 }] }, randomUUID());
    assert.equal(p.statusCode, 201, p.body);
    const pedido = p.json().id as string;
    iguales(await dosVeces(`/lavanderia/${pedido}/cobro`, { medio: 'EFECTIVO' }), 200);
    iguales(await dosVeces(`/lavanderia/${pedido}/entrega`, {}), 200);
    assert.equal(await contar('SELECT count(*)::int AS n FROM pagos WHERE pedido_lavanderia_id = $1', [pedido]), 1);
  });

  it('surtido: una sola entrada de existencias', async () => {
    const antes = await contar('SELECT count(*)::int AS n FROM surtidos');
    const [{ id: producto }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM productos WHERE grupo = 'NEVERA' AND activo LIMIT 1`);
    iguales(await dosVeces('/surtidos', { producto_id: producto, cantidad: 6 }, admin), 201);
    assert.equal(await contar('SELECT count(*)::int AS n FROM surtidos'), antes + 1);
  });

  it('solicitud de factura: una sola', async () => {
    const antes = await contar('SELECT count(*)::int AS n FROM solicitudes_factura');
    iguales(await dosVeces(`/estadias/${e205}/solicitudes-factura`, { documento: '900000001-1', correo: 'factura@ejemplo.test' }), 201);
    assert.equal(await contar('SELECT count(*)::int AS n FROM solicitudes_factura'), antes + 1);
  });

  it('cambio de habitación: el reintento devuelve el cambio hecho, no un error', async () => {
    const entrada = await pedir('/estadias', {
      habitacion_numero: '206', modalidad: 'NOCHE', personas: 1,
      huesped: { nombre: 'Huésped Prueba 206', tipo_documento: 'CC', numero_documento: 'PRUEBA0206', nacionalidad: 'Colombia', es_menor: false },
      autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 45000 },
    }, randomUUID());
    assert.equal(entrada.statusCode, 201, entrada.body);
    e.avanzarMinutos(2);
    const r = await dosVeces(`/estadias/${entrada.json().id}/cambio-habitacion`, { habitacion_numero: '201' });
    iguales(r, 200);
    assert.equal(r.segunda.json().habitacion_numero, '201');
  });

  it('una clave usada para otra operación: 409', async () => {
    const clave = randomUUID();
    assert.equal((await pedir(`/estadias/${e205}/danos`, { descripcion: 'Vaso roto', valor: 5000 }, clave, admin)).statusCode, 201);
    assert.equal((await pedir('/surtidos', { producto_id: await id('Buso'), cantidad: 1 }, clave, admin)).statusCode, 409);
  });
});

describe('HAL-04 — las claves guardadas se purgan a los 30 días (ADR-011)', () => {
  it('borra las de más de 30 días y conserva las recientes', async () => {
    const total = await contar('SELECT count(*)::int AS n FROM solicitudes_idempotentes');
    assert.ok(total > 0);
    // `creada_en` lo pone la base con su hora real (now()), no con el reloj de la prueba.
    const en29dias = new Date(Date.now() + 29 * 86_400_000);
    assert.equal((await purgarSolicitudesVencidas(e.bd, en29dias)).purgadas, 0);
    const en31dias = new Date(Date.now() + 31 * 86_400_000);
    assert.equal((await purgarSolicitudesVencidas(e.bd, en31dias)).purgadas, total);
    assert.equal(await contar('SELECT count(*)::int AS n FROM solicitudes_idempotentes'), 0);
  });
});
