// TICKET-25 · solicitudes de factura (FR-28, RN-23): recepción anota RUT o NIT, correo y teléfono; la administración
// la marca enviada al contador y luego entregada. El sistema no hace facturas (SOW §5). Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entornoConSesiones, type Entorno } from './pruebas/entorno.ts';
import { fechaPrevista, fechaPrevistaHasta, festivosColombia } from './facturacion/fechas.ts';
import { anonimizarVencidos } from './privacidad/anonimizacion.ts';

describe('RN-23 — fecha prevista de la factura', () => {
  // [cuándo se pidió (Bogotá), fecha prevista, por qué]
  const casos: Array<[string, string, string]> = [
    ['2026-10-16T10:00:00-05:00', '2026-10-19', 'pedida un viernes, el lunes siguiente'],
    ['2026-10-09T15:00:00-05:00', '2026-10-13', 'si ese lunes es festivo (12 de octubre), el martes'],
    ['2026-11-13T09:00:00-05:00', '2026-11-17', 'si ese lunes es festivo (16 de noviembre), el martes'],
    ['2026-10-16T23:30:00-05:00', '2026-10-19', 'cuenta el día de Bogotá: un viernes a las 11:30 p. m. sigue siendo viernes'],
    ['2026-10-17T08:00:00-05:00', '2026-10-19', 'sábado, el lunes'],
    ['2026-10-18T08:00:00-05:00', '2026-10-19', 'domingo, el lunes'],
    ['2026-10-13T08:00:00-05:00', '2026-10-14', 'entre semana, el siguiente día hábil [P/V]'],
    ['2026-04-01T10:00:00-05:00', '2026-04-06', 'salta Jueves y Viernes Santo'],
  ];
  for (const [pedida, esperada, porque] of casos) {
    it(porque, () => assert.equal(fechaPrevista(new Date(pedida)), esperada));
  }

  // V5-09 y V5-10: el contador tarda de 1 a 3 días hábiles (sin sábados, domingos ni festivos).
  const hasta: Array<[string, string, string]> = [
    ['2026-10-16T10:00:00-05:00', '2026-10-21', 'viernes: hasta el miércoles (3 días hábiles)'],
    ['2026-11-13T09:00:00-05:00', '2026-11-19', 'viernes antes del festivo del lunes 16: hasta el jueves'],
    ['2026-10-13T08:00:00-05:00', '2026-10-16', 'martes: hasta el viernes'],
    ['2026-12-30T10:00:00-05:00', '2027-01-05', 'fin de año: salta el 1 de enero y el fin de semana'],
  ];
  for (const [pedida, esperada, porque] of hasta) {
    it(`hasta 3 días hábiles — ${porque}`, () => assert.equal(fechaPrevistaHasta(new Date(pedida)), esperada));
  }

  it('festivos de Colombia en 2026 (Ley 51 de 1983: los trasladables pasan al lunes)', () => {
    assert.deepEqual(festivosColombia(2026), [
      '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08',
      '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16',
      '2026-12-08', '2026-12-25',
    ]);
  });
});

interface Solicitud {
  id: string; estadia_id: string; habitacion_numero: string; documento: string | null; correo: string | null; telefono: string | null;
  estado: string; fecha_prevista: string; fecha_prevista_hasta: string; registrada_por: string; registrada_en: string;
  enviada_por: string | null; enviada_en: string | null; entregada_por: string | null; entregada_en: string | null;
}

let e: Entorno;
let recepcion: string;
let admin: string;
let e205: string;
before(async () => { ({ e, recepcion, admin, e205 } = await entornoConSesiones('2026-10-16T10:00:00-05:00')); });
after(async () => e.cerrar());

const pedir = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown, cookie = recepcion) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie } });
const DATOS = { documento: '900123456-7', correo: 'factura.prueba@ejemplo.test', telefono: '+573000000002' };

describe('FR-28 — recepción anota la solicitud desde la estadía', () => {
  let s: Solicitud;

  it('201: queda PENDIENTE, con quién la registró y la fecha prevista (viernes → lunes)', async () => {
    const r = await pedir('POST', `/estadias/${e205}/solicitudes-factura`, DATOS);
    assert.equal(r.statusCode, 201, r.body);
    s = r.json();
    assert.deepEqual([s.habitacion_numero, s.documento, s.correo, s.telefono, s.estado, s.registrada_por, s.fecha_prevista],
      ['205', DATOS.documento, DATOS.correo, DATOS.telefono, 'PENDIENTE', 'recepcion2', '2026-10-19']);
    assert.equal(s.registrada_en, '2026-10-16T10:00:00-05:00');
    assert.equal(s.fecha_prevista_hasta, '2026-10-21', 'entre 1 y 3 días hábiles: del lunes 19 al miércoles 21');
  });

  it('la ficha de la estadía la muestra con su estado', async () => {
    const r = await pedir('GET', `/estadias/${e205}/solicitudes-factura`);
    assert.equal(r.statusCode, 200);
    assert.deepEqual((r.json().items as Solicitud[]).map((x) => [x.id, x.estado]), [[s.id, 'PENDIENTE']]);
  });

  it('basta el RUT con el correo o con el teléfono; sin ninguno de los dos, 400', async () => {
    assert.equal((await pedir('POST', `/estadias/${e205}/solicitudes-factura`, { documento: '12345678' })).statusCode, 400);
    e.avanzarMinutos(1); // más reciente que la primera: el orden «la más antigua primero» no depende del id
    const soloTel = await pedir('POST', `/estadias/${e205}/solicitudes-factura`, { documento: '12345678', telefono: '+573000000003' });
    assert.equal(soloTel.statusCode, 201, soloTel.body);
    assert.equal(soloTel.json().correo, null);
  });

  it('un RUT, correo o teléfono mal escrito: 400', async () => {
    for (const malo of [{ ...DATOS, documento: 'ABC' }, { ...DATOS, correo: 'sin-arroba' }, { ...DATOS, telefono: '3001234567' }]) {
      assert.equal((await pedir('POST', `/estadias/${e205}/solicitudes-factura`, malo)).statusCode, 400);
    }
  });

  it('una estadía que no existe: 404', async () => {
    const r = await pedir('POST', '/estadias/00000000-0000-4000-8000-000000000000/solicitudes-factura', DATOS);
    assert.equal(r.statusCode, 404);
  });

  it('recepción no ve la lista general ni avanza estados: 403', async () => {
    assert.equal((await pedir('GET', '/solicitudes-factura')).statusCode, 403);
    assert.equal((await pedir('PATCH', `/solicitudes-factura/${s.id}`, { estado: 'ENVIADA_AL_CONTADOR' })).statusCode, 403);
  });
});

describe('FR-28 — la administración la avanza: PENDIENTE → ENVIADA_AL_CONTADOR → ENTREGADA', () => {
  let s: Solicitud;
  before(async () => {
    s = (await pedir('GET', '/solicitudes-factura?estado=PENDIENTE', undefined, admin)).json().items[0];
  });

  it('ve las pendientes, la más antigua primero', async () => {
    assert.equal(s.documento, DATOS.documento);
    assert.equal(s.estado, 'PENDIENTE');
  });

  it('no puede saltarse un paso: 409 TRANSICION_INVALIDA', async () => {
    const r = await pedir('PATCH', `/solicitudes-factura/${s.id}`, { estado: 'ENTREGADA' }, admin);
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().codigo, 'TRANSICION_INVALIDA');
  });

  it('enviada al contador y luego entregada, con quién y cuándo', async () => {
    e.fijarHora('2026-10-19T09:00:00-05:00');
    admin = await e.entrar('admin'); // la sesión anterior venció con el salto del reloj
    const enviada = await pedir('PATCH', `/solicitudes-factura/${s.id}`, { estado: 'ENVIADA_AL_CONTADOR' }, admin);
    assert.equal(enviada.statusCode, 200, enviada.body);
    assert.deepEqual([enviada.json().estado, enviada.json().enviada_por, enviada.json().enviada_en], ['ENVIADA_AL_CONTADOR', 'admin', '2026-10-19T09:00:00-05:00']);
    const entregada = await pedir('PATCH', `/solicitudes-factura/${s.id}`, { estado: 'ENTREGADA' }, admin);
    assert.deepEqual([entregada.json().estado, entregada.json().entregada_por], ['ENTREGADA', 'admin']);
    assert.ok(!(await pedir('GET', '/solicitudes-factura?estado=PENDIENTE', undefined, admin)).json().items.some((x: Solicitud) => x.id === s.id));
  });

  it('una entregada ya no cambia: 409', async () => {
    assert.equal((await pedir('PATCH', `/solicitudes-factura/${s.id}`, { estado: 'ENTREGADA' }, admin)).statusCode, 409);
  });

  it('cada cambio queda auditado sin el RUT, el correo ni el teléfono (FR-20)', async () => {
    const filas = await e.bd.consultar<{ accion: string; detalle: Record<string, string> }>(
      `SELECT accion, detalle FROM auditoria WHERE entidad = 'solicitudes_factura' AND entidad_id = $1 ORDER BY id`, [s.id]);
    assert.deepEqual(filas.map((f) => [f.accion, f.detalle.estado]), [['CREAR', 'PENDIENTE'], ['ACTUALIZAR', 'ENVIADA_AL_CONTADOR'], ['ACTUALIZAR', 'ENTREGADA']]);
    const texto = JSON.stringify(filas);
    for (const dato of ['900123456', 'ejemplo.test', '3000000002']) assert.ok(!texto.includes(dato), dato);
  });

  it('una solicitud que no existe: 404', async () => {
    assert.equal((await pedir('PATCH', '/solicitudes-factura/00000000-0000-4000-8000-000000000000', { estado: 'ENTREGADA' }, admin)).statusCode, 404);
  });
});

describe('FR-21 — los datos de la solicitud se borran con la anonimización', () => {
  it('cuando se anonimiza el huésped, la solicitud queda sin RUT, correo ni teléfono; el estado se conserva', async () => {
    e.fijarHora('2026-10-19T10:00:00-05:00');
    recepcion = await e.entrar('recepcion2');
    const entrada = await pedir('POST', '/estadias', {
      habitacion_numero: '201', modalidad: 'NOCHE', personas: 1,
      huesped: { nombre: 'Huésped Prueba Factura', nacionalidad: 'Colombia', es_menor: false },
      autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 60000 },
    });
    assert.equal(entrada.statusCode, 201, entrada.body);
    const estadia = entrada.json().id as string;
    const s = (await pedir('POST', `/estadias/${estadia}/solicitudes-factura`, DATOS)).json() as Solicitud;
    assert.equal((await pedir('POST', `/estadias/${estadia}/salida`)).statusCode, 200);
    await e.bd.consultar(
      `UPDATE estadias SET entrada_en = '2026-07-01T10:00:00-05:00', salida_prevista_en = '2026-07-02T12:00:00-05:00', salida_real_en = '2026-07-02T11:00:00-05:00' WHERE id = $1`,
      [estadia]);
    await anonimizarVencidos(e.bd, new Date('2026-10-19T11:00:00-05:00'));
    const [f] = await e.bd.consultar<{ documento: string | null; correo: string | null; telefono: string | null; estado: string; anonimizado_en: Date | null }>(
      'SELECT documento, correo, telefono, estado, anonimizado_en FROM solicitudes_factura WHERE id = $1', [s.id]);
    assert.deepEqual([f.documento, f.correo, f.telefono, f.estado], [null, null, null, 'PENDIENTE']);
    assert.ok(f.anonimizado_en);
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'ANONIMIZAR' AND entidad = 'solicitudes_factura'`);
    assert.equal(a.detalle.cantidad, '1');
  });
});
