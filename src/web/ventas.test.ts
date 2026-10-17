// TICKET-22 · venta de contado en la PWA: textos sin habitación y cobro en efectivo sin abonos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cobroContado, origenPago } from './ventas.ts';
import { avisoEvento, lineasDelTurno, type PagoTurno } from './logica.ts';

const pago = (o: Partial<PagoTurno>): PagoTurno => ({
  id: 'p1', habitacion_numero: null, venta_detalle: 'Agua × 2, Gatorade × 1', medio: 'EFECTIVO', valor: 10000, estado: 'EN_CAJA',
  registrado_en: '2026-10-13T05:10:00-05:00', registrado_por: 'recepcion2', anulado: false, ...o,
});

describe('origen del pago', () => {
  it('habitación o venta de contado con su detalle', () => {
    assert.equal(origenPago(pago({ habitacion_numero: '211', venta_detalle: null })), 'Habitación 211');
    assert.equal(origenPago(pago({})), 'Venta de contado · Agua × 2, Gatorade × 1');
  });
  it('en «Lo de este turno», la venta se ve como venta de contado', () => {
    assert.deepEqual(lineasDelTurno([pago({})], []).map((l) => [l.concepto, l.valor, l.enCaja]),
      [['Venta de contado · Agua × 2, Gatorade × 1 · Efectivo', 10000, true]]);
  });
});

describe('avisos en vivo de una venta sin habitación', () => {
  const base = { id: '1', ocurrido_en: '2026-10-13T05:10:00-05:00', habitacion_numero: null, entidad_id: 'p1', valor: 7000 };
  it('dice «de una venta de contado» y no pide cobrar antes de la salida', () => {
    assert.deepEqual(avisoEvento({ ...base, tipo: 'pago.por_verificar' }), { tono: 'info', texto: 'Nueva transferencia por confirmar: $7.000 de una venta de contado.' });
    assert.deepEqual(avisoEvento({ ...base, tipo: 'pago.verificado' }), { tono: 'exito', texto: 'Llegó la transferencia de $7.000 de una venta de contado.' });
    assert.deepEqual(avisoEvento({ ...base, tipo: 'pago.rechazado' }),
      { tono: 'alerta', texto: 'La transferencia de $7.000 de una venta de contado NO llegó. Avise a la administración.' });
  });
});

describe('cobro de contado en efectivo', () => {
  it('sin valor escrito es pago exacto', () => {
    assert.deepEqual(cobroContado(10000, ''), { puede: true, titulo: 'Pago exacto', valor: 0 });
  });
  it('si recibe más, calcula las vueltas', () => {
    assert.deepEqual(cobroContado(10000, '20.000'), { puede: true, titulo: 'Vueltas', valor: 10000 });
  });
  it('si recibe menos, no deja registrar: de contado no hay abonos', () => {
    assert.deepEqual(cobroContado(10000, '5000'), { puede: false, titulo: 'Falta', valor: 5000 });
  });
});
