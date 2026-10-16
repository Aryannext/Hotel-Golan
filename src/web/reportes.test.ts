import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diaHotelActual, fechaReporte, errorRango } from './reportes.ts';

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
