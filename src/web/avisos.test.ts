// TICKET-16 · avisos en pantalla (FR-23, RN-04): salidas vencidas, transferencias por verificar y habitaciones por atender.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { avisosExistencias, calcularAvisos, haceCuanto, ordenarAvisos } from './avisos.ts';
import type { Habitacion } from './api.ts';

const hab = (numero: string, estado: string, estadia: Partial<NonNullable<Habitacion['estadia_activa']>> | null = null, nota: string | null = null): Habitacion => ({
  numero, tipo: 'VENTILADOR', estado, nota,
  estadia_activa: estadia && { id: `e${numero}`, nombre_corto: 'Huésped P.', salida_prevista_en: '2026-10-13T12:00:00-05:00', saldo: 0, por_verificar: 0, vencida: false, ...estadia },
});
const reglas = { valor_hora: 8000, hora_noche_completa: 16 };
const ahora = Date.parse('2026-10-13T13:20:00-05:00');

describe('FR-23 — avisos en pantalla', () => {
  it('dice hace cuánto venció, en palabras', () => {
    assert.equal(haceCuanto(Date.parse('2026-10-13T12:00:00-05:00'), ahora), '1 h 20 min');
    assert.equal(haceCuanto(Date.parse('2026-10-13T13:15:00-05:00'), ahora), '5 min');
    assert.equal(haceCuanto(Date.parse('2026-10-13T11:20:00-05:00'), ahora), '2 h');
    assert.equal(haceCuanto(Date.parse('2026-10-13T13:19:40-05:00'), ahora), 'menos de 1 min');
    assert.equal(haceCuanto(Date.parse('2026-10-10T05:01:00-05:00'), ahora), '3 días y 8 h');
    assert.equal(haceCuanto(Date.parse('2026-10-12T13:00:00-05:00'), ahora), '1 día');
  });

  it('una salida vencida avisa que corre el valor por hora y la regla de la noche completa (RN-04)', () => {
    const [a] = calcularAvisos([hab('205', 'OCUPADA', {})], reglas, ahora);
    assert.deepEqual(a, {
      clave: 'vencida-205', tipo: 'VENCIDA', tono: 'alerta', habitacion: '205',
      titulo: 'Hab. 205: la salida venció hace 1 h 20 min',
      detalle: 'Corre $8.000 por hora. Desde las 4:00 p. m. se cobra la noche completa. Extienda o dé salida.',
    });
  });

  it('se calcula con la hora actual, sin esperar al servidor: aparece al pasar la hora de salida', () => {
    const h = [hab('205', 'OCUPADA', { salida_prevista_en: '2026-10-13T13:30:00-05:00', vencida: false })];
    assert.equal(calcularAvisos(h, reglas, ahora).length, 0);
    assert.equal(calcularAvisos(h, reglas, Date.parse('2026-10-13T13:31:00-05:00'))[0].tipo, 'VENCIDA');
  });

  it('transferencia por verificar, por revisar y limpieza; sin nombres de huéspedes', () => {
    const avisos = calcularAvisos([
      hab('211', 'OCUPADA', { salida_prevista_en: '2026-10-14T12:00:00-05:00', por_verificar: 30000 }),
      hab('207', 'POR_REVISAR', null, 'Salió a las 5:50 a. m.'),
      hab('204', 'LIMPIEZA', null, 'Cambio de sábanas'),
      hab('201', 'DISPONIBLE'),
      hab('301', 'MANTENIMIENTO', null, 'Ducha en reparación'),
    ], reglas, ahora);
    assert.deepEqual(avisos.map((a) => [a.tipo, a.titulo, a.detalle]), [
      ['POR_VERIFICAR', 'Hab. 211: transferencia por verificar de $30.000', 'La administración debe confirmar si llegó.'],
      ['POR_REVISAR', 'Hab. 207: por revisar', 'Salió a las 5:50 a. m.'],
      ['LIMPIEZA', 'Hab. 204: en limpieza', 'Cambio de sábanas'],
    ]);
    assert.ok(avisos.every((a) => !JSON.stringify(a).includes('Huésped')));
  });

  it('ordena de lo más urgente a lo menos: vencidas, transferencias, por revisar, limpieza', () => {
    const avisos = calcularAvisos([
      hab('204', 'LIMPIEZA'), hab('207', 'POR_REVISAR'),
      hab('211', 'OCUPADA', { salida_prevista_en: '2026-10-14T12:00:00-05:00', por_verificar: 30000 }),
      hab('205', 'OCUPADA', { por_verificar: 10000 }),
    ], reglas, ahora);
    assert.deepEqual(avisos.map((a) => a.clave), ['vencida-205', 'verificar-205', 'verificar-211', 'revisar-207', 'limpieza-204']);
    assert.equal(avisos.find((a) => a.clave === 'revisar-207')!.detalle, 'Revise cómo quedó antes de volver a ocuparla.');
  });

  it('sin reglas todavía (cargando), la salida vencida avisa sin valores', () => {
    const [a] = calcularAvisos([hab('205', 'OCUPADA', {})], null, ahora);
    assert.equal(a.detalle, 'Extienda o dé salida.');
  });
});

describe('TICKET-21 · aviso de existencias (RN-21)', () => {
  const ex = (nombre: string, surtido: number, vendido: number) => ({ producto_id: nombre, nombre, grupo: 'NEVERA', surtido, vendido, existencias: surtido - vendido });
  it('avisa los productos surtidos alguna vez que quedan en 0 o menos', () => {
    assert.deepEqual(avisosExistencias([ex('Agua', 10, 4), ex('Gatorade', 6, 6), ex('Hit', 2, 3)]).map((a) => [a.tipo, a.titulo, a.detalle]), [
      ['EXISTENCIAS', 'Gatorade: se acabó', 'Según lo que llegó y lo vendido no queda ninguno. Revise y anote lo que llegue.'],
      ['EXISTENCIAS', 'Hit: falta 1', 'Se vendió más de lo que se anotó como llegado. Revise la vitrina o la nevera.'],
    ]);
  });
  it('lo que nunca se ha surtido no avisa (al empezar todo está en 0)', () => {
    assert.deepEqual(avisosExistencias([ex('Coca-Cola', 0, 1), ex('Squash', 0, 0)]), []);
  });
  it('los avisos de existencias van después de los de habitaciones', () => {
    const todos = ordenarAvisos([...avisosExistencias([ex('Gatorade', 6, 6)]), ...calcularAvisos([hab('207', 'POR_REVISAR')], reglas, ahora)]);
    assert.deepEqual(todos.map((a) => a.tipo), ['POR_REVISAR', 'EXISTENCIAS']);
  });
});
