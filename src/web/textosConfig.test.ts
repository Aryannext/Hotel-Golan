// Textos de ayuda que leen la configuración (TICKET-15): nada de importes fijos en pantalla.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { avisoLimpiezaEspecial, ayudaHoras, ayudaPersonas, ayudaRecargoAseo, textoDescuento } from './textosConfig.ts';
import type { Tarifa } from './ajustes.ts';
import type { Producto } from './logica.ts';

const tarifa = (tipo_habitacion: Tarifa['tipo_habitacion'], modalidad: Tarifa['modalidad'], personas: number, valor: number): Tarifa =>
  ({ id: `${tipo_habitacion}-${modalidad}-${personas}-${valor}`, tipo_habitacion, modalidad, personas, valor, vigente_desde: '2026-10-01T00:00:00-05:00' });
const TARIFAS = [
  tarifa('AIRE', 'NOCHE', 1, 60000), tarifa('AIRE', 'NOCHE', 2, 70000), tarifa('AIRE', 'NOCHE', 3, 95000),
  tarifa('VENTILADOR', 'NOCHE', 1, 45000), tarifa('VENTILADOR', 'NOCHE', 2, 55000), tarifa('VENTILADOR', 'NOCHE', 3, 80000),
  tarifa('AIRE', 'TRES_HORAS', 1, 35000), tarifa('VENTILADOR', 'TRES_HORAS', 1, 25000),
];
const SOLO_MAXIMO = 'Máximo 3. Con 4, ofrezca dos habitaciones.';

describe('textoDescuento: el botón usa reglas.descuento_noche', () => {
  it('muestra el valor configurado', () => {
    assert.equal(textoDescuento({ descuento_noche: 5000 }), '− $5.000 por noche');
    assert.equal(textoDescuento({ descuento_noche: 6000 }), '− $6.000 por noche');
  });
  it('sin reglas cargadas no inventa un valor', () => {
    assert.equal(textoDescuento(null), 'Con descuento');
  });
  it('con descuento en $0 no hay rebaja que ofrecer', () => {
    assert.equal(textoDescuento({ descuento_noche: 0 }), null);
  });
});

describe('ayudaPersonas: el adicional de la tercera sale de las tarifas de noche', () => {
  it('es la diferencia entre 3 y 2 personas del tipo de habitación', () => {
    assert.equal(ayudaPersonas('NOCHE', 'AIRE', TARIFAS), 'Máximo 3: la tercera paga $25.000. Con 4, ofrezca dos habitaciones.');
    const caras = TARIFAS.map((t) => (t.tipo_habitacion === 'VENTILADOR' && t.modalidad === 'NOCHE' && t.personas === 3 ? { ...t, valor: 90000 } : t));
    assert.equal(ayudaPersonas('NOCHE', 'VENTILADOR', caras), 'Máximo 3: la tercera paga $35.000. Con 4, ofrezca dos habitaciones.');
  });
  it('sin tarifas cargadas solo da el máximo', () => {
    assert.equal(ayudaPersonas('NOCHE', 'AIRE', null), SOLO_MAXIMO);
    assert.equal(ayudaPersonas('NOCHE', 'AIRE', []), SOLO_MAXIMO);
  });
  it('si falta la tarifa de 2 o de 3 personas, solo da el máximo', () => {
    assert.equal(ayudaPersonas('NOCHE', 'AIRE', TARIFAS.filter((t) => !(t.tipo_habitacion === 'AIRE' && t.personas === 3))), SOLO_MAXIMO);
    assert.equal(ayudaPersonas('NOCHE', 'AIRE', TARIFAS.filter((t) => !(t.tipo_habitacion === 'AIRE' && t.modalidad === 'NOCHE' && t.personas === 2))), SOLO_MAXIMO);
  });
  it('no mezcla tipos de habitación ni modalidades', () => {
    const sinVentilador3 = TARIFAS.filter((t) => !(t.tipo_habitacion === 'VENTILADOR' && t.personas === 3));
    assert.equal(ayudaPersonas('NOCHE', 'VENTILADOR', sinVentilador3), SOLO_MAXIMO);
    assert.equal(ayudaPersonas('NOCHE', 'AIRE', sinVentilador3), 'Máximo 3: la tercera paga $25.000. Con 4, ofrezca dos habitaciones.');
  });
  it('si hay dos tarifas para la misma combinación, no adivina cuál vale', () => {
    assert.equal(ayudaPersonas('NOCHE', 'AIRE', [...TARIFAS, tarifa('AIRE', 'NOCHE', 3, 100000)]), SOLO_MAXIMO);
  });
  it('si la de 3 no cuesta más que la de 2, no habla de adicional', () => {
    const iguales = TARIFAS.map((t) => (t.tipo_habitacion === 'AIRE' && t.modalidad === 'NOCHE' && t.personas === 3 ? { ...t, valor: 70000 } : t));
    assert.equal(ayudaPersonas('NOCHE', 'AIRE', iguales), SOLO_MAXIMO);
  });
  it('en tres horas: máximo 2, sin adicional', () => {
    assert.equal(ayudaPersonas('TRES_HORAS', 'AIRE', TARIFAS), 'En tres horas entran máximo 2, sin adicional.');
    assert.equal(ayudaPersonas('TRES_HORAS', 'VENTILADOR', null), 'En tres horas entran máximo 2, sin adicional.');
  });
});

describe('ayudaHoras: extender por horas usa reglas.valor_hora', () => {
  it('muestra el valor configurado', () => {
    assert.equal(ayudaHoras({ valor_hora: 8000 }), '$8.000 por hora empezada, solo para extender. Sin descuento.');
    assert.equal(ayudaHoras({ valor_hora: 9000 }), '$9.000 por hora empezada, solo para extender. Sin descuento.');
  });
  it('sin reglas cargadas no inventa un valor', () => {
    assert.equal(ayudaHoras(null), 'Se cobra la hora empezada, solo para extender. Sin descuento.');
  });
});

describe('ayudaRecargoAseo: el recargo sale del catálogo', () => {
  const producto = (nombre: string, precio: number, activo = true): Producto =>
    ({ id: nombre, nombre, grupo: 'OTROS', precio, seccion: null, pertenece_a: 'HOTEL', activo });
  it('usa el precio del producto «Recargo aseo extremo»', () => {
    assert.equal(ayudaRecargoAseo([producto('Llave perdida', 40000), producto('Recargo aseo extremo', 20000)]),
      'Si fue extremo (vómito, fluidos), al huésped se le cobran $20.000 y se le entregan a quien hace el aseo.');
    assert.equal(ayudaRecargoAseo([producto('Recargo aseo extremo', 25000)]),
      'Si fue extremo (vómito, fluidos), al huésped se le cobran $25.000 y se le entregan a quien hace el aseo.');
  });
  it('sin el producto (no cargado, inactivo o repetido) no inventa un valor', () => {
    const generico = 'Si fue extremo (vómito, fluidos), al huésped se le cobra el recargo de aseo del catálogo y se le entrega a quien hace el aseo.';
    assert.equal(ayudaRecargoAseo(null), generico);
    assert.equal(ayudaRecargoAseo([producto('Recargo aseo extremo', 20000, false)]), generico);
    assert.equal(ayudaRecargoAseo([producto('Recargo aseo extremo', 20000), producto('Recargo aseo extremo', 30000)]), generico);
  });
  it('el aviso al pasar a limpieza especial también lo lee del catálogo', () => {
    assert.equal(avisoLimpiezaEspecial('205', [producto('Recargo aseo extremo', 20000)]),
      'Habitación 205 en limpieza especial. Recuerde: el recargo de $20.000 se le entrega a quien limpió (salida de caja).');
    assert.equal(avisoLimpiezaEspecial('205', null),
      'Habitación 205 en limpieza especial. Recuerde: el recargo se le entrega a quien limpió (salida de caja).');
  });
});
