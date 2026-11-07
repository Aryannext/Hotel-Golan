import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estadoTurno, filaTurno, lineasCaja, tonoDiferencia, ultimoDeCadaTipo } from './caja.ts';
import type { Turno } from './api.ts';

const turno = (p: Partial<Turno> = {}): Turno => ({
  id: 't1', tipo: 'DIA', estado: 'ABIERTO', responsable: 'recepcion1', recibido_de: 'recepcion2',
  inicio_en: '2026-10-16T07:00:00-05:00', fin_en: null, fin_programado_en: '2026-10-16T15:00:00-05:00',
  base_entregada: 100000, base_recibida: 100000,
  caja: { base_recibida: 100000, efectivo: 420000, salidas: 70000, debe_haber: 450000, transferencias: 0, por_verificar_cantidad: 0, pago_turno: 448000 },
  cierre: null,
  ...p,
});

const cierre = (p: Partial<NonNullable<Turno['cierre']>> = {}): NonNullable<Turno['cierre']> => ({
  pago_tomado: true, efectivo_esperado: 450000, efectivo_contado: 448000, diferencia: -2000,
  efectivo_esperado_ajustado: 450000, diferencia_ajustada: -2000,
  motivo_diferencia: 'Falta de $2.000 por error en vuelto.', entregado_por: 'recepcion1',
  ...p,
});

describe('Caja: estado del turno', () => {
  it('traduce el estado a una palabra', () => {
    assert.equal(estadoTurno(turno()), 'En curso');
    assert.equal(estadoTurno(turno({ estado: 'CERRADO' })), 'Cerrado');
    assert.equal(estadoTurno(turno({ estado: 'POR_RECIBIR' })), 'Por recibir');
  });
});

describe('Caja: líneas del turno', () => {
  it('con el turno abierto, el conteo y la diferencia no se saben todavía', () => {
    const l = lineasCaja(turno());
    const por = (e: string) => l.find((x) => x.etiqueta === e);
    assert.equal(por('Base recibida')?.valor, 100000);
    assert.equal(por('Ingresos en efectivo')?.valor, 420000);
    assert.equal(por('Egresos en efectivo')?.valor, 70000);
    assert.equal(por('Efectivo esperado')?.valor, 450000);
    assert.equal(por('Pago del turno')?.valor, 448000);
    // Lo que solo existe al entregar: null, no un cero ni una estimación.
    assert.equal(por('Efectivo contado')?.valor, null);
    assert.equal(por('Diferencia')?.valor, null);
  });

  it('con el turno cerrado toma las cifras del cierre', () => {
    const l = lineasCaja(turno({ estado: 'CERRADO', cierre: cierre() }));
    const por = (e: string) => l.find((x) => x.etiqueta === e);
    assert.equal(por('Efectivo esperado')?.valor, 450000);
    assert.equal(por('Efectivo contado')?.valor, 448000);
    assert.equal(por('Diferencia')?.valor, -2000);
    assert.equal(por('Diferencia')?.tono, 'negativo');
  });

  it('va siempre en el orden del boceto', () => {
    assert.deepEqual(lineasCaja(turno()).map((l) => l.etiqueta), [
      'Base recibida', 'Ingresos en efectivo', 'Egresos en efectivo',
      'Efectivo esperado', 'Efectivo contado', 'Pago del turno', 'Diferencia',
    ]);
  });
});

describe('Caja: tono de la diferencia', () => {
  it('cuadrada no se pinta; faltante y sobrante sí', () => {
    assert.equal(tonoDiferencia(0), undefined);
    assert.equal(tonoDiferencia(-2000), 'negativo');
    assert.equal(tonoDiferencia(3000), 'positivo');
  });
});

describe('Caja: fila del historial', () => {
  it('un turno cerrado trae conteo y diferencia', () => {
    const f = filaTurno(turno({ estado: 'CERRADO', cierre: cierre() }));
    assert.equal(f.responsable, 'recepcion1');
    assert.equal(f.esperado, 450000);
    assert.equal(f.contado, 448000);
    assert.equal(f.diferencia, -2000);
    assert.equal(f.estado, 'Cerrado');
  });

  it('un turno por recibir no tiene responsable ni conteo', () => {
    const f = filaTurno(turno({ estado: 'POR_RECIBIR', responsable: null, base_recibida: null }));
    assert.equal(f.responsable, '—');
    assert.equal(f.contado, null);
    assert.equal(f.diferencia, null);
    // Sin base recibida todavía, se cae a la que trae el resumen de caja.
    assert.equal(f.baseRecibida, 100000);
  });
});

describe('Caja: último turno de cada tipo', () => {
  it('toma el más reciente de día y de noche', () => {
    const { dia, noche } = ultimoDeCadaTipo([
      turno({ id: 'a', tipo: 'DIA', inicio_en: '2026-10-15T07:00:00-05:00' }),
      turno({ id: 'b', tipo: 'NOCHE', inicio_en: '2026-10-15T15:00:00-05:00' }),
      turno({ id: 'c', tipo: 'DIA', inicio_en: '2026-10-16T07:00:00-05:00' }),
    ]);
    assert.equal(dia?.id, 'c');
    assert.equal(noche?.id, 'b');
  });

  it('si falta un tipo, va null en vez de inventar uno', () => {
    const { dia, noche } = ultimoDeCadaTipo([turno({ tipo: 'DIA' })]);
    assert.equal(dia?.tipo, 'DIA');
    assert.equal(noche, null);
  });
});
