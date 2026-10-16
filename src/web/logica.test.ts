// TICKET-01 · lógica de presentación de la PWA (sin JSX, se prueba con node --test).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claseEstado, textoEstado, pesos, horaBogota, diaRelativo, contarEstados, iniciales, maxPersonas, ajustarPersonas, textoSalida, leerPesos, diferenciaConteo, nombreTurno } from './logica.ts';

describe('Presentación del mapa de habitaciones', () => {
  it('traduce los estados de la API a las clases y textos del prototipo', () => {
    assert.deepEqual(
      ['DISPONIBLE', 'OCUPADA', 'POR_REVISAR', 'LIMPIEZA', 'MANTENIMIENTO'].map((e) => [claseEstado(e), textoEstado(e)]),
      [['libre', 'Disponible'], ['ocupada', 'Ocupada'], ['revisar', 'Por revisar'], ['limpieza', 'Limpieza'], ['fuera', 'Mantenimiento']]);
  });

  it('formatea pesos colombianos sin centavos', () => {
    assert.equal(pesos(28000), '$28.000');
    assert.equal(pesos(234500), '$234.500');
    assert.equal(pesos(0), '$0');
  });

  it('muestra la hora de Bogotá tal como la manda la API, sin depender de la zona del equipo', () => {
    assert.equal(horaBogota('2026-10-13T12:00:00-05:00'), '12:00 m.');
    assert.equal(horaBogota('2026-10-13T06:30:00-05:00'), '6:30 a. m.');
    assert.equal(horaBogota('2026-10-13T18:30:00-05:00'), '6:30 p. m.');
    assert.equal(horaBogota('2026-10-13T00:15:00-05:00'), '12:15 a. m.');
  });

  it('dice hoy o mañana respecto de la fecha de referencia', () => {
    assert.equal(diaRelativo('2026-10-13T12:00:00-05:00', '2026-10-13'), 'hoy');
    assert.equal(diaRelativo('2026-10-14T12:00:00-05:00', '2026-10-13'), 'mañana');
    assert.equal(diaRelativo('2026-10-16T12:00:00-05:00', '2026-10-13'), '16/10');
  });

  it('cuenta las habitaciones por estado para los indicadores del inicio', () => {
    const c = contarEstados([{ estado: 'DISPONIBLE' }, { estado: 'OCUPADA' }, { estado: 'OCUPADA' }, { estado: 'LIMPIEZA' }, { estado: 'POR_REVISAR' }]);
    assert.deepEqual(c, { disponibles: 1, ocupadas: 2, limpiezaORevision: 2, mantenimiento: 0 });
  });

  it('saca dos iniciales para el avatar, ignorando números y paréntesis', () => {
    assert.equal(iniciales('Recepción Prueba 2 (noche entre semana)'), 'RP');
    assert.equal(iniciales('Administradora'), 'A');
  });
});

describe('TICKET-02 — Paso «Habitación y servicio»', () => {
  it('máximo 3 personas por noche y 2 en tres horas', () => {
    assert.equal(maxPersonas('NOCHE'), 3);
    assert.equal(maxPersonas('TRES_HORAS'), 2);
  });

  it('al pasar a tres horas, baja las personas a 2 si había más', () => {
    assert.equal(ajustarPersonas(3, 'TRES_HORAS'), 2);
    assert.equal(ajustarPersonas(1, 'TRES_HORAS'), 1);
    assert.equal(ajustarPersonas(0, 'NOCHE'), 1);
  });

  it('describe la salida en palabras: «mañana a las 12:00 m.»', () => {
    assert.equal(textoSalida('2026-10-14T12:00:00-05:00', '2026-10-13'), 'mañana a las 12:00 m.');
    assert.equal(textoSalida('2026-10-13T01:30:00-05:00', '2026-10-13'), 'hoy a la 1:30 a. m.');
  });
});

describe('TICKET-03 · recibir el turno y caja', () => {
  it('lee pesos escritos con puntos, signo o espacios; vacío o sin números es null', () => {
    assert.equal(leerPesos('184.500'), 184500);
    assert.equal(leerPesos('$ 183000'), 183000);
    assert.equal(leerPesos(''), null);
    assert.equal(leerPesos('abc'), null);
  });
  it('describe la diferencia entre lo contado y lo entregado', () => {
    assert.deepEqual(diferenciaConteo(184500, 184500), { tono: 'exito', texto: 'Sin diferencia' });
    assert.deepEqual(diferenciaConteo(183000, 184500), { tono: 'alerta', texto: 'Faltan $1.500' });
    assert.deepEqual(diferenciaConteo(185000, 184500), { tono: 'alerta', texto: 'Sobran $500' });
  });
  it('nombra el turno y su horario (RN-09)', () => {
    assert.equal(nombreTurno('DIA'), 'de día · 6:30 a. m. a 6:30 p. m.');
    assert.equal(nombreTurno('NOCHE'), 'de noche · 6:30 p. m. a 6:30 a. m.');
  });
});
