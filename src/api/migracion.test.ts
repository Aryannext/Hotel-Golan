// TICKET-37 · recordatorio para reportar a los extranjeros a Migración Colombia (FR-33; RN-24): quien aloje a un
// extranjero debe reportar su llegada y su salida por el SIRE (Decreto 1067 de 2015; Resolución 2357 de 2020) [V].
// Hoy nadie lo hace (HG-ACT-001 V6-02). El sistema no se conecta al SIRE: recuerda el reporte y deja constancia.
// Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entornoConSesiones, type Entorno } from './pruebas/entorno.ts';

interface Pendiente { estadia_id: string; habitacion_numero: string; tipo: 'LLEGADA' | 'SALIDA'; desde: string; atrasado: boolean }

let e: Entorno;
let recepcion: string;

const pedir = (method: 'GET' | 'POST', url: string, payload?: unknown, cookie: string | null = recepcion) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: cookie ? { cookie } : {} });
const entrada = async (habitacion: string, nacionalidad: string) => {
  const r = await pedir('POST', '/estadias', {
    habitacion_numero: habitacion, modalidad: 'NOCHE', personas: 1,
    huesped: { nombre: `Huésped Prueba ${habitacion}`, tipo_documento: 'PASAPORTE', numero_documento: `PRUEBA${habitacion}`, nacionalidad, es_menor: false },
    autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 45000 },
  });
  assert.equal(r.statusCode, 201, r.body);
  return r.json().id as string;
};
const pendientes = async () => {
  const r = await pedir('GET', '/migracion/pendientes');
  assert.equal(r.statusCode, 200, r.body);
  return r.json().items as Pendiente[];
};
const reportar = (estadia_id: string, tipo: 'LLEGADA' | 'SALIDA') => pedir('POST', '/migracion/reportes', { estadia_id, tipo });

let extranjero: string;
let colombiano: string;

before(async () => {
  ({ e, recepcion } = await entornoConSesiones('2026-10-13T06:20:00-05:00'));
  extranjero = await entrada('206', 'Venezuela');
  colombiano = await entrada('208', 'colombiana');
});
after(async () => e.cerrar());

describe('FR-33 (RN-24) — reportes a Migración Colombia', () => {
  it('la entrada de un extranjero deja pendiente su llegada; la de un colombiano no', async () => {
    const items = await pendientes();
    assert.deepEqual(items.map((p) => [p.habitacion_numero, p.tipo, p.atrasado]), [['206', 'LLEGADA', false]]);
    assert.equal(items[0].estadia_id, extranjero);
    // El aviso no lleva datos del huésped.
    assert.ok(!JSON.stringify(items).includes('Huésped Prueba'));
  });

  it('los datos para llenar el SIRE se piden aparte y cada consulta queda en la auditoría, sin los datos', async () => {
    const r = await pedir('GET', `/migracion/datos/${extranjero}`);
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().nombre, r.json().tipo_documento, r.json().numero_documento, r.json().nacionalidad],
      ['Huésped Prueba 206', 'PASAPORTE', 'PRUEBA206', 'Venezuela']);
    const filas = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'CONSULTAR' AND entidad = 'reporte_migracion'`);
    assert.equal(filas.length, 1);
    assert.ok(!JSON.stringify(filas).includes('PRUEBA206'));
    assert.equal(filas[0].detalle.habitacion, '206');
  });

  it('pasadas las horas configuradas (24) sin reportar, queda «atrasado»', async () => {
    e.fijarHora('2026-10-14T06:30:00-05:00');
    recepcion = await e.entrar('recepcion2');
    assert.deepEqual((await pendientes()).map((p) => p.atrasado), [true]);
    e.fijarHora('2026-10-13T06:25:00-05:00');
    recepcion = await e.entrar('recepcion2');
  });

  it('«Ya lo reporté» lo quita de la lista y queda en la auditoría; marcarlo otra vez es 409', async () => {
    const r = await reportar(extranjero, 'LLEGADA');
    assert.equal(r.statusCode, 201, r.body);
    assert.deepEqual([r.json().tipo, r.json().habitacion_numero, r.json().reportado_por], ['LLEGADA', '206', 'recepcion2']);
    assert.deepEqual(await pendientes(), []);
    const [a] = await e.bd.consultar<{ accion: string; detalle: Record<string, string> }>(
      `SELECT accion, detalle FROM auditoria WHERE entidad = 'reporte_migracion' AND accion = 'CREAR'`);
    assert.deepEqual(a.detalle, { habitacion: '206', tipo: 'LLEGADA' });
    assert.equal((await reportar(extranjero, 'LLEGADA')).statusCode, 409);
  });

  it('no hay nada que reportar de un colombiano ni de una salida que no ha pasado: 409', async () => {
    assert.equal((await reportar(colombiano, 'LLEGADA')).statusCode, 409);
    assert.equal((await reportar(extranjero, 'SALIDA')).statusCode, 409);
  });

  it('al dar salida al extranjero queda pendiente el reporte de su salida', async () => {
    assert.equal((await pedir('POST', `/estadias/${extranjero}/salida`)).statusCode, 200);
    assert.deepEqual((await pendientes()).map((p) => [p.habitacion_numero, p.tipo]), [['206', 'SALIDA']]);
    assert.equal((await reportar(extranjero, 'SALIDA')).statusCode, 201);
    assert.deepEqual(await pendientes(), []);
  });

  it('si el extranjero desiste antes de reportar su llegada, no queda nada pendiente', async () => {
    const id = await entrada('209', 'Ecuador');
    assert.equal((await pendientes()).length, 1);
    const d = await pedir('POST', `/estadias/${id}/devoluciones`, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' });
    assert.equal(d.statusCode, 201, d.body);
    assert.deepEqual(await pendientes(), []);
  });

  it('sin sesión: 401; una estadía que no existe: 404', async () => {
    assert.equal((await pedir('GET', '/migracion/pendientes', undefined, null)).statusCode, 401);
    assert.equal((await reportar('00000000-0000-4000-8000-000000000000', 'LLEGADA')).statusCode, 404);
  });
});
