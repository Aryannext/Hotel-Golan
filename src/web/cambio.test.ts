// TICKET-26 · cambio de habitación en la PWA (FR-30; RN-17): qué pasa con la plata, en palabras.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resumenCambio, disponiblesPara } from './cambio.ts';

const hoy = '2026-10-14';
const base = { habitacion_numero: '201', diferencia: 0, devolucion: 0, a_favor_pendiente: 0, salida_prevista_en: '2026-10-15T12:00:00-05:00' };

describe('RN-17 — resumen del cambio', () => {
  it('a los pocos minutos, a una más cara: paga la diferencia', () => {
    assert.deepEqual(resumenCambio({ ...base, tipo: 'SIN_USO', diferencia: 15000 }, hoy),
      { titulo: 'Paga la diferencia', valor: 15000, detalle: 'Cambió de opinión a los pocos minutos: se cobra solo la diferencia. La salida no cambia.' });
  });

  it('a los pocos minutos, a una más barata: se le devuelve en efectivo', () => {
    assert.deepEqual(resumenCambio({ ...base, tipo: 'SIN_USO', diferencia: -15000, devolucion: 15000 }, hoy),
      { titulo: 'Se le devuelve', valor: 15000, detalle: 'Cambió de opinión a los pocos minutos: se le devuelve la diferencia en efectivo (sale de la caja). La salida no cambia.' });
  });

  it('si pagó por transferencia, lo que queda a favor lo decide la administración', () => {
    assert.match(resumenCambio({ ...base, tipo: 'SIN_USO', diferencia: -15000, a_favor_pendiente: 15000 }, hoy).detalle, /administración decide/);
  });

  it('ya usó la habitación: se cobra la nueva completa y cambia la salida', () => {
    assert.deepEqual(resumenCambio({ ...base, tipo: 'NOCHE_NUEVA', diferencia: 55000 }, hoy),
      { titulo: 'Se cobra la 201 completa', valor: 55000, detalle: 'Ya usó la habitación: se cobra una noche nueva. Nueva salida: mañana a las 12:00 m.' });
  });
});

describe('FR-30 — habitaciones a las que se puede pasar', () => {
  it('solo las disponibles, sin la actual', () => {
    const habs = [{ numero: '201', estado: 'DISPONIBLE' }, { numero: '202', estado: 'OCUPADA' }, { numero: '205', estado: 'DISPONIBLE' }, { numero: '206', estado: 'LIMPIEZA' }];
    assert.deepEqual(disponiblesPara(habs, '205').map((h) => h.numero), ['201']);
  });
});
