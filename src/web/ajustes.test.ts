// TICKET-15 · presentación de la configuración (FR-22): tarifas, reglas y productos en palabras sencillas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { etiquetaTarifa, tarifasCambiadas, reglasCambiadas, textoHora, erroresProducto, GRUPOS_EDITABLES, textoRegla, leerCantidadSurtido, NOTA_FAMILIAR } from './ajustes.ts';

const tarifas = [
  { id: 't1', tipo_habitacion: 'AIRE' as const, modalidad: 'NOCHE' as const, personas: 1, valor: 60000, vigente_desde: '2026-10-01T00:00:00-05:00' },
  { id: 't2', tipo_habitacion: 'AIRE' as const, modalidad: 'TRES_HORAS' as const, personas: 2, valor: 35000, vigente_desde: '2026-10-01T00:00:00-05:00' },
  { id: 't3', tipo_habitacion: 'VENTILADOR' as const, modalidad: 'NOCHE' as const, personas: 3, valor: 80000, vigente_desde: '2026-10-01T00:00:00-05:00' },
];
const reglas = { valor_hora: 8000, hora_noche_completa: 16, descuento_noche: 5000, pago_turno_dia: 70000, pago_turno_noche: 50000, retencion_datos_dias: 90, minutos_cambio_sin_cargo: 5 };

describe('FR-22 — tarifas en la PWA', () => {
  it('nombra cada tarifa como la dice el hotel', () => {
    assert.deepEqual(tarifas.map(etiquetaTarifa), ['Aire · noche · 1 persona', 'Aire · tres horas (1 o 2 personas)', 'Ventilador · noche · 3 personas']);
  });

  it('envía solo las tarifas que cambiaron y avisa los valores que no sirven', () => {
    assert.deepEqual(tarifasCambiadas(tarifas, { t1: '65.000', t2: '35000', t3: '' }), {
      items: [{ tipo_habitacion: 'AIRE', modalidad: 'NOCHE', personas: 1, valor: 65000 }], errores: { t3: 'Escriba un valor mayor que $0.' },
    });
    assert.deepEqual(tarifasCambiadas(tarifas, { t1: '60000', t2: '$35.000', t3: '80000' }), { items: [], errores: {} });
    assert.deepEqual(tarifasCambiadas(tarifas, { t1: '0', t2: 'abc' }).errores, { t1: 'Escriba un valor mayor que $0.', t2: 'Escriba un valor mayor que $0.' });
  });
});

describe('FR-22 — reglas en la PWA', () => {
  it('muestra la hora de la noche completa en palabras', () => {
    assert.equal(textoHora(16), '4:00 p. m.');
    assert.equal(textoHora(12), '12:00 m.');
  });

  it('envía solo las reglas que cambiaron, con sus límites', () => {
    const f = { valor_hora: '9.000', hora_noche_completa: '16', descuento_noche: '5000', pago_turno_dia: '70000', pago_turno_noche: '50000', retencion_datos_dias: '90', minutos_cambio_sin_cargo: '5' };
    assert.deepEqual(reglasCambiadas(reglas, f), { cambios: { valor_hora: 9000 }, errores: {} });
    assert.deepEqual(reglasCambiadas(reglas, { ...f, valor_hora: '8000', retencion_datos_dias: '0', descuento_noche: '' }).errores,
      { retencion_datos_dias: 'Debe estar entre 1 y 3650.', descuento_noche: 'Escriba un número.' });
    assert.deepEqual(reglasCambiadas(reglas, { ...f, valor_hora: '8000', hora_noche_completa: '18' }).cambios, { hora_noche_completa: 18 });
    // TICKET-26: minutos para cambiar de habitación ajustando solo la diferencia (0 a 120).
    assert.deepEqual(reglasCambiadas(reglas, { ...f, valor_hora: '8000', minutos_cambio_sin_cargo: '3' }).cambios, { minutos_cambio_sin_cargo: 3 });
    assert.deepEqual(reglasCambiadas(reglas, { ...f, valor_hora: '8000', minutos_cambio_sin_cargo: '200' }).errores, { minutos_cambio_sin_cargo: 'Debe estar entre 0 y 120.' });
  });

  it('describe una regla con su valor', () => {
    assert.equal(textoRegla('descuento_noche', 6000), 'Descuento máximo por noche: $6.000');
    assert.equal(textoRegla('hora_noche_completa', 17), 'Desde qué hora se cobra la noche completa: 5:00 p. m.');
    assert.equal(textoRegla('retencion_datos_dias', 90), 'Días que se guardan los datos del huésped: 90');
  });
});

describe('FR-22 — productos en la PWA', () => {
  it('FR-24: la administración edita todos los grupos, incluidas las dos vitrinas', () => {
    assert.deepEqual(GRUPOS_EDITABLES.map(([g]) => g), ['NEVERA', 'VITRINA_PASABOCAS', 'VITRINA_ASEO', 'LAVANDERIA', 'OTROS']);
  });

  it('valida nombre y precio', () => {
    assert.deepEqual(erroresProducto({ nombre: 'Jugo', precio: '3.500' }), {});
    assert.deepEqual(erroresProducto({ nombre: ' J ', precio: '-1' }), { nombre: 'Escriba el nombre (mínimo 2 letras).', precio: 'Escriba el precio en pesos.' });
    assert.deepEqual(erroresProducto({ nombre: 'Bolsa', precio: '0' }), {});
  });
});

describe('TICKET-21 · surtido en Ajustes', () => {
  it('la cantidad que llegó es un entero de 1 a 10.000', () => {
    assert.deepEqual(leerCantidadSurtido('12'), { cantidad: 12, error: null });
    for (const t of ['', '0', '-3', '2.5', 'abc', '10001']) {
      assert.deepEqual(leerCantidadSurtido(t), { cantidad: null, error: 'Escriba cuántas unidades llegaron (de 1 a 10.000).' }, t);
    }
  });
});

describe('RN-13 (V5-19) — productos de la familiar', () => {
  it('la nota de Ajustes habla de los productos de la familiar, estén en la sección que estén, y no de la sección 1', () => {
    assert.match(NOTA_FAMILIAR, /familiar/);
    assert.match(NOTA_FAMILIAR, /estén en la sección que estén/);
    assert.doesNotMatch(NOTA_FAMILIAR, /sección 1/);
  });
});
