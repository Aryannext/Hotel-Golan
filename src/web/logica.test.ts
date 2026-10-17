// TICKET-01 · lógica de presentación de la PWA (sin JSX, se prueba con node --test).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claseEstado, textoEstado, pesos, horaBogota, diaRelativo, contarEstados, iniciales, maxPersonas, ajustarPersonas, textoSalida, leerPesos, diferenciaConteo, nombreTurno, erroresHuesped, aHuespedInput, cambioEfectivo, enmascarar, HUESPED_VACIO, nuevaClave, avisoEvento, textoMedio, agruparCatalogo, resumenSeleccion, estadoSaldo, valorPago, accionesEstado, lineasDelTurno, TIPOS_SALIDA, debeDejar, avisoTemprano, resumenExtension, devolucionPosible, puedeAnular } from './logica.ts';

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
    assert.equal(pesos(999), '$999');
    assert.equal(pesos(1000), '$1.000');
    assert.equal(pesos(1234567), '$1.234.567');
    assert.equal(pesos(-5000), '$-5.000');
    assert.equal(pesos(2500.6), '$2.501');
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

describe('TICKET-06 · ficha de la habitación: cargos y pagos', () => {
  const p = (id: string, nombre: string, grupo: string, precio: number) => ({ id, nombre, grupo, precio, seccion: null, pertenece_a: 'HOTEL', activo: true });
  const catalogo = [p('1', 'Coca-Cola', 'NEVERA', 4000), p('2', 'Toalla', 'LAVANDERIA', 3000), p('3', 'Llave perdida', 'OTROS', 40000), p('4', 'Champú', 'VITRINA_ASEO', 6000)];
  it('agrupa el catálogo en nevera, vitrinas, lavandería y otros (FR-24)', () => {
    const conPasabocas = [...catalogo, p('5', 'Galletas', 'VITRINA_PASABOCAS', 2000)];
    assert.deepEqual(agruparCatalogo(conPasabocas).map(([g, ps]) => [g, ps.map((x) => x.nombre)]),
      [['Nevera', ['Coca-Cola']], ['Vitrina de pasabocas', ['Galletas']], ['Vitrina de aseo', ['Champú']], ['Lavandería', ['Toalla']], ['Llave, aseo y otros', ['Llave perdida']]]);
  });
  it('resume la selección múltiple con cantidades y total', () => {
    const r = resumenSeleccion(catalogo, { 1: 2, 3: 1, 2: 0 });
    assert.deepEqual(r.items.map((x) => [x.producto.nombre, x.cantidad, x.subtotal]), [['Coca-Cola', 2, 8000], ['Llave perdida', 1, 40000]]);
    assert.equal(r.total, 48000);
  });
  it('describe el saldo: debe, por verificar o al día', () => {
    assert.deepEqual(estadoSaldo({ total_cargos: 84000, pagado: 26000, por_verificar: 30000, saldo: 28000, a_favor: 0 }),
      { tono: 'alerta', titulo: 'Debe', detalle: 'Además hay $30.000 por verificar', valor: 28000 });
    assert.deepEqual(estadoSaldo({ total_cargos: 45000, pagado: 0, por_verificar: 45000, saldo: 0, a_favor: 0 }),
      { tono: 'aviso', titulo: 'Por verificar', detalle: 'Queda al día cuando la administración confirme la transferencia', valor: 45000 });
    assert.deepEqual(estadoSaldo({ total_cargos: 55000, pagado: 55000, por_verificar: 0, saldo: 0, a_favor: 0 }),
      { tono: 'ok', titulo: 'Al día', detalle: 'No debe nada', valor: 0 });
  });
  it('en efectivo cobra hasta el saldo y lo demás son vueltas; por transferencia, lo escrito', () => {
    assert.deepEqual(valorPago('EFECTIVO', 28000, 50000), { valor: 28000, vueltas: 22000 });
    assert.deepEqual(valorPago('EFECTIVO', 28000, 10000), { valor: 10000, vueltas: 0 });
    assert.deepEqual(valorPago('NEQUI', 28000, 28000), { valor: 28000, vueltas: 0 });
  });
});

describe('TICKET-08 · revisión de la habitación (FR-02)', () => {
  it('ofrece solo las transiciones permitidas, en palabras sencillas', () => {
    assert.deepEqual(accionesEstado('POR_REVISAR').map((a) => [a.estado, a.texto, a.especial ?? false, a.pideNota ?? false]), [
      ['LIMPIEZA', 'Limpieza normal', false, false],
      ['LIMPIEZA', 'Limpieza especial (fluidos o manchas)', true, false],
      ['MANTENIMIENTO', 'Daño: mantenimiento', false, true],
    ]);
    assert.deepEqual(accionesEstado('LIMPIEZA').map((a) => [a.estado, a.texto]), [['DISPONIBLE', 'Limpia y revisada']]);
    assert.deepEqual(accionesEstado('MANTENIMIENTO').map((a) => [a.estado, a.texto]), [['POR_REVISAR', 'Ya está arreglada']]);
    assert.deepEqual(accionesEstado('OCUPADA'), []);
    assert.deepEqual(accionesEstado('DISPONIBLE'), []);
  });
});

describe('TICKET-10 · salidas de dinero y «Lo de este turno»', () => {
  it('ofrece los tipos de salida en palabras sencillas; la devolución no está (sale desde la estadía)', () => {
    assert.deepEqual(TIPOS_SALIDA.map((t) => t.tipo), ['COMPRA_HOTEL', 'RETIRO_ADMINISTRACION', 'RECARGO_ASEO', 'OTRO']);
    assert.equal(TIPOS_SALIDA.find((t) => t.tipo === 'RECARGO_ASEO')?.valor, 20000);
  });
  it('mezcla cobros y salidas del turno en orden de hora; las salidas restan y las transferencias no van a la caja', () => {
    const pagos = [
      { id: 'p1', habitacion_numero: '211', medio: 'EFECTIVO', valor: 22000, estado: 'EN_CAJA', registrado_en: '2026-10-12T23:30:00-05:00', registrado_por: 'recepcion2', anulado: false },
      { id: 'p2', habitacion_numero: '205', medio: 'NEQUI', valor: 55000, estado: 'VERIFICADO', registrado_en: '2026-10-12T19:12:00-05:00', registrado_por: 'recepcion2', anulado: false },
    ];
    const salidas = [{ id: 'm1', tipo: 'COMPRA_HOTEL', detalle: '2 jabones', valor: 10000, habitacion_numero: null, registrado_en: '2026-10-13T05:30:00-05:00', registrado_por: 'recepcion2', anulado: false }];
    assert.deepEqual(lineasDelTurno(pagos, salidas).map((l) => [l.id, l.concepto, l.valor, l.enCaja]), [
      ['p2', 'Cobro · Hab. 205 · Nequi', 55000, false],
      ['p1', 'Cobro · Hab. 211 · Efectivo', 22000, true],
      ['m1', 'Compra para el hotel · 2 jabones', -10000, true],
    ]);
  });
});

describe('TICKET-11 · entregar el turno', () => {
  it('debe dejar el «debe haber» menos el pago del turno si lo tomó', () => {
    assert.equal(debeDejar(234500, 50000, true), 184500);
    assert.equal(debeDejar(234500, 50000, false), 234500);
  });
  it('avisa si entrega más de 60 minutos antes del fin programado', () => {
    const fin = '2026-10-13T06:30:00-05:00';
    assert.equal(avisoTemprano(fin, Date.parse('2026-10-13T06:20:00-05:00')), null);
    assert.equal(avisoTemprano(fin, Date.parse('2026-10-13T05:30:00-05:00')), null);
    assert.equal(avisoTemprano(fin, Date.parse('2026-10-13T05:29:00-05:00')), 'Su turno termina hoy a las 6:30 a. m. Entregue solo cuando llegue quien lo recibe.');
  });
});

describe('TICKET-07 · extender la estadía (RN-04)', () => {
  it('advierte cuando las horas pasan de las 4:00 p. m. y dice la nueva salida en palabras', () => {
    assert.deepEqual(resumenExtension({ modalidad_cobrada: 'NOCHE', valor: 60000, salida_prevista_en: '2026-10-13T12:00:00-05:00', pasa_de_las_4: true }, '2026-10-12'),
      { aviso: 'Pasaría de las 4:00 p. m.: se cobra la noche completa.', salida: 'mañana a las 12:00 m.' });
    assert.deepEqual(resumenExtension({ modalidad_cobrada: 'POR_HORAS', valor: 32000, salida_prevista_en: '2026-10-12T16:00:00-05:00', pasa_de_las_4: false }, '2026-10-12'),
      { aviso: null, salida: 'hoy a las 4:00 p. m.' });
  });
});

describe('TICKET-09 · desistimiento y devolución (RN-08)', () => {
  const pago = (medio: string, valor: number, estado: string) => ({ medio, valor, estado, anulado: false });
  it('solo miró: devuelve todo lo pagado en efectivo; ya la usó: nada', () => {
    const pagos = [pago('EFECTIVO', 45000, 'EN_CAJA')];
    assert.deepEqual(devolucionPosible(pagos, 'SOLO_MIRO', false), { valor: 45000, bloqueo: null });
    assert.deepEqual(devolucionPosible(pagos, 'YA_USO', false), { valor: 0, bloqueo: null });
  });
  it('con una transferencia por verificar hay que esperar a la administración', () => {
    assert.equal(devolucionPosible([pago('NEQUI', 55000, 'POR_VERIFICAR')], 'SOLO_MIRO', true).bloqueo,
      'Pagó por transferencia y todavía no se ha confirmado. Espere a que la administración la verifique.');
  });
  it('si pagó por transferencia, la devolución la decide la administración', () => {
    const pagos = [pago('BANCOLOMBIA', 45000, 'VERIFICADO')];
    assert.equal(devolucionPosible(pagos, 'SOLO_MIRO', false).bloqueo, 'Pagó por transferencia: la devolución la decide la administración.');
    assert.deepEqual(devolucionPosible(pagos, 'SOLO_MIRO', true), { valor: 45000, bloqueo: null });
  });
  it('lo rechazado o anulado no se devuelve', () => {
    const pagos = [pago('EFECTIVO', 20000, 'EN_CAJA'), pago('NEQUI', 25000, 'RECHAZADO'), { ...pago('EFECTIVO', 5000, 'EN_CAJA'), anulado: true }];
    assert.equal(devolucionPosible(pagos, 'SOLO_MIRO', false).valor, 20000);
  });
});

describe('TICKET-12 · anulaciones (FR-17)', () => {
  const pagos = [{ id: 'p1', habitacion_numero: '211', medio: 'EFECTIVO', valor: 22000, estado: 'EN_CAJA', registrado_en: '2026-10-12T23:30:00-05:00', registrado_por: 'recepcion2', anulado: false }];
  const salidas = [
    { id: 'm1', tipo: 'COMPRA_HOTEL', detalle: '2 jabones', valor: 10000, habitacion_numero: null, registrado_en: '2026-10-13T05:30:00-05:00', registrado_por: 'recepcion2', anulado: false },
    { id: 'm2', tipo: 'DEVOLUCION', detalle: 'Desistimiento', valor: 45000, habitacion_numero: '206', registrado_en: '2026-10-13T05:40:00-05:00', registrado_por: 'recepcion2', anulado: false },
    { id: 'm3', tipo: 'OTRO', detalle: 'Pilas', valor: 3000, habitacion_numero: null, registrado_en: '2026-10-13T05:50:00-05:00', registrado_por: 'recepcion2', anulado: true },
  ];
  it('solo la administración anula cobros y salidas vigentes; una devolución no se anula por aquí', () => {
    const lineas = lineasDelTurno(pagos, salidas);
    assert.deepEqual(lineas.map((l) => [l.id, l.origen, puedeAnular(l, true), puedeAnular(l, false)]), [
      ['p1', 'PAGO', true, false],
      ['m1', 'SALIDA', true, false],
      ['m2', 'SALIDA', false, false],
      ['m3', 'SALIDA', false, false],
    ]);
  });
});
