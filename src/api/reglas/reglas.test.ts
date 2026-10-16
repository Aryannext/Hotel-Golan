// TICKET-02 · núcleo de reglas puro (ADR-001). Ejemplos de docs/TESTS_ACEPTACION.feature, reglas RN-01, RN-02, RN-03 y RN-05.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularSalida, calcularTarifa, calcularDescuento, cotizar, ErrorRegla, type Tarifa } from './reglas.ts';
import { aBogota } from '../comun/tiempo.ts';

const bogota = (local: string) => new Date(local.replace(' ', 'T') + ':00-05:00');

describe('RN-01 — La salida de la noche depende de la hora de entrada', () => {
  const casos: Array<[string, number, string, string]> = [
    ['2026-10-12 02:00', 1, '2026-10-12 12:00', 'MADRUGADA_MISMO_DIA'],
    ['2026-10-12 06:00', 1, '2026-10-12 12:00', 'MADRUGADA_MISMO_DIA'],
    ['2026-10-12 06:01', 1, '2026-10-13 06:01', 'VEINTICUATRO_HORAS'],
    ['2026-10-12 06:15', 1, '2026-10-13 06:15', 'VEINTICUATRO_HORAS'],
    ['2026-10-12 06:30', 1, '2026-10-13 06:30', 'VEINTICUATRO_HORAS'],
    ['2026-10-12 10:00', 1, '2026-10-13 10:00', 'VEINTICUATRO_HORAS'],
    ['2026-10-12 11:59', 1, '2026-10-13 11:59', 'VEINTICUATRO_HORAS'],
    ['2026-10-12 12:00', 1, '2026-10-13 12:00', 'MEDIODIA_SIGUIENTE'],
    ['2026-10-12 15:00', 1, '2026-10-13 12:00', 'MEDIODIA_SIGUIENTE'],
    ['2026-10-12 22:00', 1, '2026-10-13 12:00', 'MEDIODIA_SIGUIENTE'],
    ['2026-10-12 23:59', 1, '2026-10-13 12:00', 'MEDIODIA_SIGUIENTE'],
    ['2026-10-12 03:00', 2, '2026-10-13 12:00', 'MADRUGADA_MISMO_DIA'],
    ['2026-10-12 10:00', 2, '2026-10-14 10:00', 'VEINTICUATRO_HORAS'],
    ['2026-10-12 15:00', 2, '2026-10-14 12:00', 'MEDIODIA_SIGUIENTE'],
  ];
  for (const [entrada, noches, salida, franja] of casos) {
    it(`entra ${entrada}, ${noches} noche(s) → sale ${salida} (${franja})`, () => {
      const r = calcularSalida('NOCHE', bogota(entrada), noches);
      assert.equal(aBogota(r.salida), aBogota(bogota(salida)));
      assert.equal(r.franja, franja);
    });
  }
  it('tres horas: sale 3 horas después', () => {
    const r = calcularSalida('TRES_HORAS', bogota('2026-10-12 22:30'), 1);
    assert.equal(aBogota(r.salida), '2026-10-13T01:30:00-05:00');
    assert.equal(r.franja, 'TRES_HORAS');
  });
  it('no depende de la zona horaria del servidor: usa siempre UTC−5', () => {
    // 2026-10-13 04:30 UTC = 2026-10-12 23:30 en Bogotá → sale el 13 a las 12 m.
    const r = calcularSalida('NOCHE', new Date('2026-10-13T04:30:00Z'), 1);
    assert.equal(aBogota(r.salida), '2026-10-13T12:00:00-05:00');
  });
});

const TARIFAS: Tarifa[] = [
  { tipo_habitacion: 'VENTILADOR', modalidad: 'NOCHE', personas: 1, valor: 45000 },
  { tipo_habitacion: 'VENTILADOR', modalidad: 'NOCHE', personas: 2, valor: 55000 },
  { tipo_habitacion: 'VENTILADOR', modalidad: 'NOCHE', personas: 3, valor: 80000 },
  { tipo_habitacion: 'AIRE', modalidad: 'NOCHE', personas: 1, valor: 60000 },
  { tipo_habitacion: 'AIRE', modalidad: 'NOCHE', personas: 2, valor: 70000 },
  { tipo_habitacion: 'AIRE', modalidad: 'NOCHE', personas: 3, valor: 95000 },
  { tipo_habitacion: 'VENTILADOR', modalidad: 'TRES_HORAS', personas: 2, valor: 25000 },
  { tipo_habitacion: 'AIRE', modalidad: 'TRES_HORAS', personas: 2, valor: 35000 },
];

describe('RN-02, RN-03 — La tarifa depende del tipo, la modalidad y las personas', () => {
  const casos: Array<['AIRE' | 'VENTILADOR', 'NOCHE' | 'TRES_HORAS', number, number]> = [
    ['VENTILADOR', 'NOCHE', 1, 45000], ['VENTILADOR', 'NOCHE', 2, 55000], ['VENTILADOR', 'NOCHE', 3, 80000],
    ['AIRE', 'NOCHE', 1, 60000], ['AIRE', 'NOCHE', 2, 70000], ['AIRE', 'NOCHE', 3, 95000],
    ['VENTILADOR', 'TRES_HORAS', 2, 25000], ['AIRE', 'TRES_HORAS', 1, 35000],
  ];
  for (const [tipo, modalidad, personas, total] of casos) {
    it(`${tipo} ${modalidad} con ${personas} persona(s) → $${total}`, () => {
      assert.equal(calcularTarifa(TARIFAS, tipo, modalidad, personas, 1), total);
    });
  }
  it('varias noches multiplica la tarifa por noche', () => {
    assert.equal(calcularTarifa(TARIFAS, 'AIRE', 'NOCHE', 1, 2), 120000);
  });
  it('tres horas admite máximo 2 personas: CAPACIDAD_EXCEDIDA', () => {
    assert.throws(() => calcularTarifa(TARIFAS, 'AIRE', 'TRES_HORAS', 3, 1), (e: ErrorRegla) => e.codigo === 'CAPACIDAD_EXCEDIDA');
  });
  it('una noche admite máximo 3 personas: CAPACIDAD_EXCEDIDA', () => {
    assert.throws(() => calcularTarifa(TARIFAS, 'AIRE', 'NOCHE', 4, 1), (e: ErrorRegla) => e.codigo === 'CAPACIDAD_EXCEDIDA');
  });
});

describe('RN-05 — Descuento de $5.000 por noche, solo en la modalidad de noche', () => {
  it('dos noches: $10.000', () => assert.equal(calcularDescuento('NOCHE', 2, true, 5000), 10000));
  it('sin pedirlo: $0', () => assert.equal(calcularDescuento('NOCHE', 2, false, 5000), 0));
  it('tres horas con descuento: DESCUENTO_NO_PERMITIDO', () => {
    assert.throws(() => calcularDescuento('TRES_HORAS', 1, true, 5000), (e: ErrorRegla) => e.codigo === 'DESCUENTO_NO_PERMITIDO');
  });
});

describe('Cotización completa', () => {
  it('dos noches con aire, 1 persona y descuento: $120.000 − $10.000 = $110.000; no permite pagar al salir', () => {
    const c = cotizar({ tarifas: TARIFAS, descuentoNoche: 5000, tipo: 'AIRE', modalidad: 'NOCHE', personas: 1, noches: 2, aplicarDescuento: true, entrada: bogota('2026-10-12 15:00') });
    assert.deepEqual({ tarifa: c.tarifa, descuento: c.descuento, total: c.total, alSalir: c.permitePagoAlSalir },
      { tarifa: 120000, descuento: 10000, total: 110000, alSalir: false });
    assert.equal(aBogota(c.salida), '2026-10-14T12:00:00-05:00');
  });
  it('una noche sí permite pagar al salir; tres horas no', () => {
    const base = { tarifas: TARIFAS, descuentoNoche: 5000, tipo: 'VENTILADOR' as const, personas: 2, noches: 1, aplicarDescuento: false, entrada: bogota('2026-10-12 20:00') };
    assert.equal(cotizar({ ...base, modalidad: 'NOCHE' }).permitePagoAlSalir, true);
    assert.equal(cotizar({ ...base, modalidad: 'TRES_HORAS' }).permitePagoAlSalir, false);
  });
});
