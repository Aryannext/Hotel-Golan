import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diaHotelActual, fechaReporte, errorRango, textoAjuste, rangoPeriodo, textoGrupo } from './reportes.ts';

describe('RN-15 — presentación del historial', () => {
  it('antes de las 6:30 propone el día anterior en Bogotá, incluso al cambiar de año', () => {
    assert.equal(diaHotelActual(Date.parse('2027-01-01T11:29:59Z')), '2026-12-31');
    assert.equal(diaHotelActual(Date.parse('2027-01-01T11:30:00Z')), '2027-01-01');
  });
  it('presenta la fecha sin convertirla a la zona horaria del navegador', () => {
    assert.equal(fechaReporte('2026-10-12'), '12/10/2026');
    assert.equal(fechaReporte('2026-10-13T00:15:00-05:00'), '13/10/2026');
  });
  it('rechaza fechas vacías, imposibles o invertidas y permite un solo día', () => {
    assert.ok(errorRango('', '2026-10-12'));
    assert.ok(errorRango('2026-02-30', '2026-03-01'));
    assert.ok(errorRango('2026-10-13', '2026-10-12'));
    assert.equal(errorRango('2026-10-12', '2026-10-12'), null);
    assert.equal(errorRango('2024-02-29', '2024-03-01'), null);
  });
});

describe('ADR-010 (V5-16) — diferencia ajustada por lo registrado después', () => {
  const cierre = { diferencia: 45000, diferencia_ajustada: 0, efectivo_esperado_ajustado: 229500 };
  it('si cambió, lo explica con la nueva diferencia', () => {
    assert.equal(textoAjuste(cierre), 'Con lo que se registró después (por ejemplo, una entrada del talonario) debía haber $229.500: la diferencia queda en $0.');
  });
  it('si no cambió, no dice nada', () => {
    assert.equal(textoAjuste({ ...cierre, diferencia_ajustada: 45000 }), null);
  });
});

describe('FR-32 (V5-20) — periodos del informe de productos', () => {
  it('día: el mismo día del hotel', () => {
    assert.deepEqual(rangoPeriodo('DIA', '2026-10-15'), { desde: '2026-10-15', hasta: '2026-10-15' });
  });
  it('semana: de lunes a domingo', () => {
    assert.deepEqual(rangoPeriodo('SEMANA', '2026-10-15'), { desde: '2026-10-12', hasta: '2026-10-18' });
    assert.deepEqual(rangoPeriodo('SEMANA', '2026-10-18'), { desde: '2026-10-12', hasta: '2026-10-18' });
  });
  it('mes: el mes calendario, también en febrero y diciembre', () => {
    assert.deepEqual(rangoPeriodo('MES', '2026-10-15'), { desde: '2026-10-01', hasta: '2026-10-31' });
    assert.deepEqual(rangoPeriodo('MES', '2026-02-10'), { desde: '2026-02-01', hasta: '2026-02-28' });
    assert.deepEqual(rangoPeriodo('MES', '2026-12-31'), { desde: '2026-12-01', hasta: '2026-12-31' });
  });
  it('nombra los grupos en palabras', () => {
    assert.equal(textoGrupo('VITRINA_PASABOCAS'), 'Vitrina de pasabocas');
    assert.equal(textoGrupo('LAVANDERIA'), 'Lavandería');
  });
});
