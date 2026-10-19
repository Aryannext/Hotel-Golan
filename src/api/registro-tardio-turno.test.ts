// TICKET-31 · registro tardío al turno en que entró el huésped (ADR-010; administradora, HG-ACT-001 V5-16).
// Caso de la administradora: A (recepcion2, noche) recibe a un huésped a las 3:00 a. m. con el internet caído, lo anota
// en el talonario y cuenta esa plata al entregar el turno; B (recepcion1, día) lo pasa al sistema a las 8:00 a. m.
// En la semilla, el turno de noche de recepcion2 debe tener 184.500 al entregar (234.500 − 50.000 del pago del turno).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let a: string;
let b: string;
let admin: string;
let pago: { turno_id: string };
let estadiaId: string;

const pedir = (method: 'GET' | 'POST', url: string, cookie: string, payload?: unknown) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie } });

before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:25:00-05:00');
  a = await e.entrar('recepcion2');
  // A cuenta los 45.000 del talonario junto con la caja: sobran 45.000 frente a lo que dice el sistema.
  const entrega = await pedir('POST', '/turnos/actual/entrega', a,
    { pago_tomado: true, efectivo_contado: 229500, motivo_diferencia: 'entrada de las 3 a. m. anotada en el talonario' });
  assert.equal(entrega.statusCode, 200, entrega.body);
  e.fijarHora('2026-10-13T06:35:00-05:00');
  b = await e.entrar('recepcion1');
  assert.equal((await pedir('POST', '/turnos/actual/recepcion', b, { base_contada: 229500 })).statusCode, 200);
  e.fijarHora('2026-10-13T08:00:00-05:00');
  admin = await e.entrar('admin');
  const r = await pedir('POST', '/estadias', b, {
    habitacion_numero: '206', modalidad: 'NOCHE', personas: 1,
    huesped: { nombre: 'Huésped Prueba Talonario', tipo_documento: 'CC', numero_documento: 'PRUEBA0099', nacionalidad: 'Colombia', es_menor: false },
    autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 45000 },
    registro_tardio: true, entrada_en: '2026-10-13T03:00:00-05:00',
  });
  assert.equal(r.statusCode, 201, r.body);
  estadiaId = r.json().id;
  pago = r.json().pagos[0];
});
after(async () => e.cerrar());

describe('ADR-010 (V5-16) — la plata del registro tardío es del turno en que entró el huésped', () => {
  it('el pago y la estadía quedan en el turno de A, aunque los digite B', async () => {
    assert.equal(pago.turno_id, e.semilla.turnoId);
    const [f] = await e.bd.consultar<{ turno_id: string }>('SELECT turno_id FROM estadias WHERE id = $1', [estadiaId]);
    assert.equal(f.turno_id, e.semilla.turnoId);
  });

  it('la caja abierta de B no cambia: su base ya traía esa plata', async () => {
    const caja = (await pedir('GET', '/turnos/actual', b)).json().caja;
    assert.deepEqual([caja.base_recibida, caja.efectivo, caja.debe_haber], [229500, 0, 229500]);
  });

  it('el turno de A conserva su cierre y muestra la diferencia ajustada: el sobrante queda explicado', async () => {
    const t = (await pedir('GET', `/turnos/${e.semilla.turnoId}`, admin)).json();
    assert.deepEqual([t.cierre.efectivo_esperado, t.cierre.efectivo_contado, t.cierre.diferencia], [184500, 229500, 45000]);
    assert.deepEqual([t.cierre.efectivo_esperado_ajustado, t.cierre.diferencia_ajustada], [229500, 0]);
  });

  it('la administración recibe el aviso del registro tardío en un turno cerrado', async () => {
    const [ev] = await e.bd.consultar<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM eventos_salida WHERE tipo = 'turno.diferencia' AND payload->>'momento' = 'REGISTRO_TARDIO'`);
    assert.deepEqual([ev.payload.turno_id, ev.payload.valor, ev.payload.registrado_por, ev.payload.diferencia_ajustada],
      [e.semilla.turnoId, 45000, 'recepcion1', 0]);
  });

  it('el resumen del día del hotel la cuenta en el día de la entrada real (12 de octubre)', async () => {
    const r = (await pedir('GET', '/reportes/dias?desde=2026-10-12&hasta=2026-10-12', admin)).json();
    assert.equal(r.items[0].efectivo, 26000 + 45000);
  });
});
