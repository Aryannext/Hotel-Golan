// TICKET-02 · POST /cotizaciones (FR-04) según docs/CONTRATO_API.yaml (CotizacionInput → Cotizacion).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
before(async () => { e = await crearEntorno(); cookie = await e.entrar('recepcion2'); });
after(async () => e.cerrar());

const cotizar = (payload: Record<string, unknown>, conCookie = true) =>
  e.app.inject({ method: 'POST', url: '/api/v1/cotizaciones', payload, headers: conCookie ? { cookie } : {} });

describe('FR-04 — Cotizar una estadía', () => {
  it('sin sesión: 401', async () => {
    assert.equal((await cotizar({ habitacion_numero: '201', modalidad: 'NOCHE', personas: 1 }, false)).statusCode, 401);
  });

  it('noche con aire, 3 personas, entrando a las 3:00 p. m.: $95.000 y sale mañana a las 12 m.', async () => {
    const r = await cotizar({ habitacion_numero: '201', modalidad: 'NOCHE', personas: 3, entrada_en: '2026-10-12T15:00:00-05:00' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json(), {
      tarifa: 95000, descuento: 0, total: 95000,
      salida_prevista_en: '2026-10-13T12:00:00-05:00', permite_pago_al_salir: true, franja_salida: 'MEDIODIA_SIGUIENTE',
    });
  });

  it('sin entrada_en usa la hora actual del servidor (6:10 a. m. → 24 horas)', async () => {
    const r = await cotizar({ habitacion_numero: '206', modalidad: 'NOCHE', personas: 1 });
    assert.equal(r.json().salida_prevista_en, '2026-10-14T06:10:00-05:00');
    assert.equal(r.json().franja_salida, 'VEINTICUATRO_HORAS');
  });

  it('dos noches con descuento: $120.000 − $10.000 = $110.000; no permite pagar al salir', async () => {
    const r = await cotizar({ habitacion_numero: '202', modalidad: 'NOCHE', personas: 1, noches: 2, aplicar_descuento: true, entrada_en: '2026-10-12T15:00:00-05:00' });
    assert.deepEqual([r.json().tarifa, r.json().descuento, r.json().total, r.json().permite_pago_al_salir], [120000, 10000, 110000, false]);
  });

  it('descuento menor al máximo: $3.000 por noche, dos noches = $6.000', async () => {
    const r = await cotizar({ habitacion_numero: '202', modalidad: 'NOCHE', personas: 1, noches: 2, valor_descuento: 3000, entrada_en: '2026-10-12T15:00:00-05:00' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().tarifa, r.json().descuento, r.json().total], [120000, 6000, 114000]);
  });

  it('descuento por encima del máximo: 422 DESCUENTO_EXCEDE_MAXIMO', async () => {
    const r = await cotizar({ habitacion_numero: '202', modalidad: 'NOCHE', personas: 1, valor_descuento: 6000 });
    assert.equal(r.statusCode, 422);
    assert.deepEqual([r.json().codigo, r.json().mensaje], ['DESCUENTO_EXCEDE_MAXIMO', 'El descuento máximo es $5.000 por noche.']);
  });

  it('tres horas con ventilador: $25.000, sale 3 horas después', async () => {
    const r = await cotizar({ habitacion_numero: '209', modalidad: 'TRES_HORAS', personas: 2, entrada_en: '2026-10-12T22:30:00-05:00' });
    assert.equal(r.json().total, 25000);
    assert.equal(r.json().salida_prevista_en, '2026-10-13T01:30:00-05:00');
  });

  it('4 personas en noche: 400 INVALID_PAYLOAD (el contrato permite máximo 3)', async () => {
    const r = await cotizar({ habitacion_numero: '201', modalidad: 'NOCHE', personas: 4 });
    assert.equal(r.statusCode, 400);
    assert.equal(r.json().codigo, 'INVALID_PAYLOAD');
  });

  it('3 personas en tres horas: 422 CAPACIDAD_EXCEDIDA', async () => {
    const r = await cotizar({ habitacion_numero: '201', modalidad: 'TRES_HORAS', personas: 3 });
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().codigo, 'CAPACIDAD_EXCEDIDA');
  });

  it('descuento en tres horas: 422 DESCUENTO_NO_PERMITIDO', async () => {
    const r = await cotizar({ habitacion_numero: '205', modalidad: 'TRES_HORAS', personas: 2, aplicar_descuento: true });
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().codigo, 'DESCUENTO_NO_PERMITIDO');
  });

  it('habitación que no existe o modalidad POR_HORAS: 400', async () => {
    assert.equal((await cotizar({ habitacion_numero: '101', modalidad: 'NOCHE', personas: 1 })).statusCode, 400);
    assert.equal((await cotizar({ habitacion_numero: '201', modalidad: 'POR_HORAS', personas: 1 })).statusCode, 400);
  });

  it('usa la tarifa vigente en la hora de entrada (FR-22)', async () => {
    await e.bd.consultar(`INSERT INTO tarifas (tipo_habitacion, modalidad, personas, valor, vigente_desde)
                          VALUES ('AIRE', 'NOCHE', 1, 65000, '2026-11-01T00:00:00-05:00')`);
    const antes = await cotizar({ habitacion_numero: '201', modalidad: 'NOCHE', personas: 1, entrada_en: '2026-10-31T20:00:00-05:00' });
    const despues = await cotizar({ habitacion_numero: '201', modalidad: 'NOCHE', personas: 1, entrada_en: '2026-11-01T20:00:00-05:00' });
    assert.equal(antes.json().total, 60000);
    assert.equal(despues.json().total, 65000);
  });
});
