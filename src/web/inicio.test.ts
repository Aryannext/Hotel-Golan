import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ocupacion,
  dineroDelDia,
  textoVariacion,
  calcularFlujoDia,
  calcularDesgloseMedios,
  obtenerActividadReciente,
  calcularSegmentosDona,
} from './inicio.ts';
import type { ResumenDia } from './api.ts';

const dia = (d: string, efectivo: number, verificadas = 0, pendientes = 0): ResumenDia => ({
  dia: d, desde: `${d}T06:30:00-05:00`, hasta: `${d}T06:30:00-05:00`, turnos: [],
  efectivo, transferencias_verificadas: verificadas, transferencias_pendientes: pendientes,
  descuentos: 0, salidas: 0, diferencias: 0,
});

describe('Inicio: ocupación del hotel', () => {
  it('cuenta por estado y saca el porcentaje de ocupadas', () => {
    const habs = [{ estado: 'OCUPADA' }, { estado: 'OCUPADA' }, { estado: 'DISPONIBLE' }, { estado: 'LIMPIEZA' }];
    const o = ocupacion(habs);
    assert.equal(o.ocupadas, 2);
    assert.equal(o.disponibles, 1);
    assert.equal(o.limpiezaORevision, 1);
    assert.equal(o.total, 4);
    assert.equal(o.porcentaje, 50);
  });

  it('sin habitaciones no divide por cero', () => {
    assert.deepEqual(ocupacion([]), { ocupadas: 0, disponibles: 0, limpiezaORevision: 0, mantenimiento: 0, total: 0, porcentaje: 0 });
  });

  it('redondea el porcentaje', () => {
    // 1 de 3 = 33,33 %
    assert.equal(ocupacion([{ estado: 'OCUPADA' }, { estado: 'DISPONIBLE' }, { estado: 'DISPONIBLE' }]).porcentaje, 33);
  });
});

describe('Inicio: dinero del día', () => {
  it('los ingresos son el efectivo más las transferencias ya verificadas', () => {
    const r = dineroDelDia([dia('2026-10-19', 100000, 50000, 30000)], '2026-10-19');
    assert.equal(r?.ingresos, 150000);
    assert.equal(r?.transferenciasPendientes, 30000, 'lo pendiente no se cuenta como cobrado');
  });

  it('compara contra el día anterior', () => {
    const r = dineroDelDia([dia('2026-10-18', 100000), dia('2026-10-19', 112000)], '2026-10-19');
    assert.equal(r?.variacion, 12);
  });

  it('sin día anterior con movimiento no inventa una comparación', () => {
    assert.equal(dineroDelDia([dia('2026-10-19', 100000)], '2026-10-19')?.variacion, null);
    assert.equal(dineroDelDia([dia('2026-10-18', 0), dia('2026-10-19', 100000)], '2026-10-19')?.variacion, null);
  });

  it('devuelve null si el día pedido no vino en el informe', () => {
    assert.equal(dineroDelDia([dia('2026-10-18', 100000)], '2026-10-19'), null);
  });

  it('toma el día anterior más cercano, no el primero de la lista', () => {
    const r = dineroDelDia([dia('2026-10-01', 500000), dia('2026-10-18', 100000), dia('2026-10-19', 50000)], '2026-10-19');
    assert.equal(r?.variacion, -50);
  });
});

describe('Inicio: texto de la comparación', () => {
  it('escribe el signo y avisa cuando no hay con qué comparar', () => {
    assert.equal(textoVariacion(12), '+12% vs. ayer');
    assert.equal(textoVariacion(-8), '-8% vs. ayer');
    assert.equal(textoVariacion(0), 'igual que ayer');
    assert.equal(textoVariacion(null), null);
  });
});

describe('Inicio: flujo del día y desglose de pagos', () => {
  it('calcula entradas y salidas del día', () => {
    const f = calcularFlujoDia([
      { estado: 'OCUPADA', estadia_activa: { salida_prevista_en: '2026-10-16T12:00:00-05:00' } },
      { estado: 'OCUPADA', estadia_activa: null },
      { estado: 'DISPONIBLE', estadia_activa: null },
    ], '2026-10-16');
    assert.equal(f.entradasHoy, 2);
    assert.equal(f.salidasHoy, 1);
  });

  it('desglosa los medios de pago detallados', () => {
    const d = calcularDesgloseMedios(null, [
      { medio: 'EFECTIVO', valor: 310000, estado: 'EN_CAJA' },
      { medio: 'NEQUI', valor: 70000, estado: 'VERIFICADO' },
      { medio: 'BANCOLOMBIA', valor: 40000, estado: 'VERIFICADO' },
      { medio: 'NEQUI', valor: 20000, estado: 'POR_VERIFICAR' },
    ]);
    assert.equal(d.efectivo, 310000);
    assert.equal(d.nequi, 70000);
    assert.equal(d.bancolombia, 40000);
    assert.equal(d.total, 420000);
  });

  it('calcula segmentos de dona sin dividir por cero', () => {
    const sVacia = calcularSegmentosDona(0, 0, 0);
    assert.equal(sVacia.segmentos.length, 0);

    const s = calcularSegmentosDona(8, 4, 0);
    assert.equal(s.segmentos.length, 3);
    assert.equal(s.segmentos[0].valor, 8);
    assert.equal(s.segmentos[1].valor, 4);
  });

  it('formatea la actividad reciente ordenando por fecha', () => {
    const act = obtenerActividadReciente([
      { id: '1', habitacion_numero: '201', valor: 60000, registrado_en: '2026-10-16T07:15:00-05:00', estado: 'EN_CAJA' },
      { id: '2', habitacion_numero: '207', valor: 35000, registrado_en: '2026-10-16T10:12:00-05:00', estado: 'EN_CAJA' },
      { id: '3', habitacion_numero: '202', valor: 70000, registrado_en: '2026-10-16T08:30:00-05:00', estado: 'VERIFICADO' },
    ]);
    assert.equal(act.length, 3);
    assert.equal(act[0].hora, '10:12');
    assert.equal(act[0].habitacion, '207');
    assert.equal(act[1].hora, '08:30');
    assert.equal(act[2].hora, '07:15');
  });
});

