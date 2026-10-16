// TICKET-01 · lógica de presentación de la PWA (sin JSX, se prueba con node --test).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claseEstado, textoEstado, pesos, horaBogota, diaRelativo, contarEstados, iniciales, maxPersonas, ajustarPersonas, textoSalida, leerPesos, diferenciaConteo, nombreTurno, erroresHuesped, aHuespedInput, cambioEfectivo, enmascarar, HUESPED_VACIO, nuevaClave, avisoEvento, textoMedio } from './logica.ts';

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

describe('TICKET-04 · asistente de entrada', () => {
  const base = { ...HUESPED_VACIO, nombre: 'Huésped Prueba 40', autorizo: true };
  it('pide nombre, autorización y, para un menor, el acompañante verificado', () => {
    assert.deepEqual(erroresHuesped(base), {});
    assert.deepEqual(Object.keys(erroresHuesped({ ...HUESPED_VACIO })).sort(), ['autorizo', 'nombre']);
    assert.ok(erroresHuesped({ ...base, esMenor: true }).acompanante);
    assert.deepEqual(erroresHuesped({ ...base, esMenor: true, acompanante: true }), {});
  });
  it('valida el número de documento y el teléfono de 10 dígitos', () => {
    assert.ok(erroresHuesped({ ...base, tipoDocumento: 'CC', numeroDocumento: '12' }).numeroDocumento);
    assert.ok(erroresHuesped({ ...base, tipoDocumento: 'CC', numeroDocumento: '' }).numeroDocumento);
    assert.ok(erroresHuesped({ ...base, telefono: '300 12' }).telefono);
    assert.deepEqual(erroresHuesped({ ...base, telefono: '300 123 4567' }), {});
  });
  it('arma el huésped para la API: sin documento si no lo dio, teléfono con +57 y documento sin puntos', () => {
    assert.deepEqual(aHuespedInput(base), { nombre: 'Huésped Prueba 40', nacionalidad: 'Colombia', es_menor: false });
    assert.deepEqual(aHuespedInput({ ...base, tipoDocumento: 'CC', numeroDocumento: '98.765.432', telefono: '300 123 4567', esMenor: true, acompanante: true }), {
      nombre: 'Huésped Prueba 40', nacionalidad: 'Colombia', es_menor: true, acompanante_verificado: true,
      tipo_documento: 'CC', numero_documento: '98765432', telefono: '+573001234567',
    });
  });
  it('calcula vueltas o abono con el efectivo recibido', () => {
    assert.deepEqual(cambioEfectivo(55000, 60000), { tipo: 'vueltas', valor: 5000 });
    assert.deepEqual(cambioEfectivo(55000, 55000), { tipo: 'exacto', valor: 0 });
    assert.deepEqual(cambioEfectivo(55000, 20000), { tipo: 'abono', valor: 35000 });
  });
  it('enmascara el documento: ••••432', () => {
    assert.equal(enmascarar('98.765.432'), '••••432');
    assert.equal(enmascarar(''), '');
  });
});

describe('TICKET-04 · clave de idempotencia', () => {
  it('genera un UUID v4 aunque la conexión no sea segura (sin randomUUID)', () => {
    const k = nuevaClave({ getRandomValues: (a) => crypto.getRandomValues(a) });
    assert.match(k, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(nuevaClave(), nuevaClave());
  });
});

describe('TICKET-05 · pagos por confirmar y avisos en vivo', () => {
  it('nombra el medio de pago en palabras', () => {
    assert.deepEqual(['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'].map(textoMedio), ['Efectivo', 'Nequi', 'Bancolombia']);
  });
  it('convierte el evento de verificación en un aviso sencillo para recepción', () => {
    const base = { id: '9', ocurrido_en: '2026-10-13T06:20:00-05:00', entidad_id: 'x', habitacion_numero: '211', valor: 30000 };
    assert.deepEqual(avisoEvento({ ...base, tipo: 'pago.verificado' }), { tono: 'exito', texto: 'Llegó la transferencia de $30.000 de la habitación 211.' });
    assert.deepEqual(avisoEvento({ ...base, tipo: 'pago.rechazado' }),
      { tono: 'alerta', texto: 'La transferencia de $30.000 de la habitación 211 NO llegó: cóbrela de nuevo antes de la salida.' });
    assert.deepEqual(avisoEvento({ ...base, tipo: 'pago.por_verificar' }), { tono: 'info', texto: 'Nueva transferencia por confirmar: $30.000 de la habitación 211.' });
    assert.equal(avisoEvento({ ...base, tipo: 'habitacion.actualizada' }), null);
  });
});

describe('TICKET-05 · fechas relativas', () => {
  it('dice «ayer» para el día anterior', () => {
    assert.equal(diaRelativo('2026-10-12T20:12:00-05:00', '2026-10-13'), 'ayer');
    assert.equal(diaRelativo('2026-10-11T20:12:00-05:00', '2026-10-13'), '11/10');
  });
});
