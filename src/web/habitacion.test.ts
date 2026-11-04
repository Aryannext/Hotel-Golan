import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { consumos, datosEstadia, fechaLarga, franjaEntrada, porQueNoSale, tarifaNoche, textoSaldo, totalVigente } from './habitacion.ts';
import type { Cargo, Estadia } from './api.ts';

describe('Franja visual de entrada en Bogotá', () => {
  it('distingue los límites del día con fechas UTC y no con la zona del dispositivo', () => {
    assert.equal(franjaEntrada('2026-10-29T10:59:00Z'), 'noche');
    assert.equal(franjaEntrada('2026-10-29T11:00:00Z'), 'dia');
    assert.equal(franjaEntrada('2026-10-29T22:59:00Z'), 'dia');
    assert.equal(franjaEntrada('2026-10-29T23:00:00Z'), 'noche');
    assert.equal(franjaEntrada('2026-10-29T00:30:00-05:00'), 'noche');
  });
  it('no inventa una franja si falta la hora', () => assert.equal(franjaEntrada(''), null));
});

const cargo = (p: Partial<Cargo> = {}): Cargo => ({
  id: 'c1', tipo: 'ALOJAMIENTO', concepto: 'Alojamiento noche 1', cantidad: 1,
  valor_unitario: 70000, valor: 70000, creado_por: 'recepcion1', creado_en: '2026-10-15T15:20:00-05:00',
  anulado: false, ...p,
});

const cuenta = (p: Partial<Estadia['cuenta']> = {}): Estadia['cuenta'] =>
  ({ total_cargos: 140000, pagado: 140000, por_verificar: 0, saldo: 0, a_favor: 0, devuelto: 0, ...p });

const estadia = (p: Partial<Estadia> = {}): Estadia => ({
  id: 'e1', habitacion_numero: '201', modalidad: 'NOCHE', personas: 2, noches: 2,
  entrada_en: '2026-10-15T15:20:00-05:00', salida_prevista_en: '2026-10-17T12:00:00-05:00',
  estado: 'ACTIVA', forma_cobro: 'AL_SALIR', registro_tardio: false,
  registrada_por: 'recepcion1', registrada_en: '2026-10-15T15:20:00-05:00',
  huesped: { id: 'h1', nombre_mostrado: 'Huésped Prueba 01', tipo_documento: 'CC', documento_enmascarado: '••••1234', nacionalidad: 'CO', anonimizado: false },
  cargos: [cargo(), cargo({ id: 'c2', concepto: 'Alojamiento noche 2' })],
  pagos: [],
  cuenta: cuenta(),
  ...p,
} as Estadia);

const fmt = {
  fecha: (iso: string) => iso.slice(0, 10),
  hora: (iso: string) => iso.slice(11, 16),
  pesos: (n: number) => `$${n.toLocaleString('es-CO')}`,
};

describe('Habitación: tarifa por noche', () => {
  it('la toma del valor unitario del alojamiento', () => {
    assert.equal(tarifaNoche([cargo(), cargo({ id: 'c2' })]), 70000);
  });

  it('sin cargos de alojamiento todavía, no se adivina: va null', () => {
    assert.equal(tarifaNoche([]), null);
    assert.equal(tarifaNoche([cargo({ tipo: 'NEVERA', concepto: 'Gaseosa' })]), null);
  });

  it('un alojamiento anulado no cuenta como tarifa', () => {
    assert.equal(tarifaNoche([cargo({ anulado: true })]), null);
  });
});

describe('Habitación: consumos y total', () => {
  it('separa los consumos del alojamiento', () => {
    const c = consumos([cargo(), cargo({ id: 'c2', tipo: 'NEVERA', concepto: 'Gaseosa', valor: 6000 })]);
    assert.equal(c.length, 1);
    assert.equal(c[0].concepto, 'Gaseosa');
  });

  it('el total vigente excluye lo anulado', () => {
    assert.equal(totalVigente([cargo(), cargo({ id: 'c2', valor: 30000, anulado: true })]), 70000);
  });
});

describe('Habitación: filas de información', () => {
  it('van en el orden del boceto y con los datos que existen', () => {
    const d = datosEstadia(estadia(), fmt);
    assert.deepEqual(d.map((x) => x.etiqueta), [
      'Huésped actual', 'Personas', 'Entrada', 'Salida prevista', 'Noches', 'Tarifa por noche', 'Total de cargos',
    ]);
    assert.equal(d[0].valor, 'Huésped Prueba 01');
    assert.equal(d[1].valor, '2');
    assert.equal(d[2].valor, '2026-10-15 · 15:20');
    assert.equal(d[5].valor, '$70.000');
  });

  it('sin cargos de alojamiento, la tarifa va con guion', () => {
    const d = datosEstadia(estadia({ cargos: [] }), fmt);
    assert.equal(d.find((x) => x.etiqueta === 'Tarifa por noche')?.valor, '—');
  });
});

describe('Habitación: cómo se lee el saldo', () => {
  it('distingue pendiente, a favor y al día', () => {
    assert.deepEqual(textoSaldo(cuenta({ saldo: 42000 })), { texto: 'Saldo pendiente', tono: 'alerta' });
    assert.deepEqual(textoSaldo(cuenta({ a_favor: 5000 })), { texto: 'Queda a favor', tono: 'exito' });
    assert.deepEqual(textoSaldo(cuenta()), { texto: 'Cuenta al día', tono: 'neutro' });
  });
});

describe('Habitación: por qué no se puede dar salida', () => {
  it('con saldo pendiente dice cuánto falta', () => {
    assert.equal(porQueNoSale(cuenta({ saldo: 42000 }), fmt.pesos), 'Falta cobrar $42.000 para poder dar la salida.');
  });

  it('con transferencias sin confirmar también frena', () => {
    assert.equal(porQueNoSale(cuenta({ por_verificar: 30000 }), fmt.pesos), 'Hay $30.000 en transferencias sin confirmar.');
  });

  it('con la cuenta en cero no hay impedimento', () => {
    assert.equal(porQueNoSale(cuenta(), fmt.pesos), null);
  });
});

describe('Habitación: fecha en palabras', () => {
  it('escribe el día, el mes abreviado y el año', () => {
    assert.equal(fechaLarga('2026-10-15T15:20:00-05:00'), '15 oct. 2026');
    assert.equal(fechaLarga('2026-01-01T00:00:00-05:00'), '1 ene. 2026');
    assert.equal(fechaLarga('2026-12-31T23:59:00-05:00'), '31 dic. 2026');
  });
});
