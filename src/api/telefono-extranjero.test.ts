// BD-18 (HG-HAL-001 HAL-46) · decisión del usuario (27-10-2026): el teléfono del huésped, que sigue siendo opcional,
// acepta números de otros países con + y el código del país. Antes solo celulares colombianos (+57), así que un
// extranjero no podía dejar el suyo. Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entornoConSesiones, type Entorno } from './pruebas/entorno.ts';
import { HUESPED_VACIO, aHuespedInput, erroresHuesped } from '../web/logica.ts';

let e: Entorno;
let recepcion: string;
before(async () => { ({ e, recepcion } = await entornoConSesiones('2026-10-13T06:15:00-05:00')); });
after(async () => e.cerrar());

const entrar = (habitacion: string, telefono: string) => e.app.inject({ method: 'POST', url: '/api/v1/estadias', headers: { cookie: recepcion }, payload: {
  habitacion_numero: habitacion, modalidad: 'NOCHE', personas: 1,
  huesped: { nombre: 'Huésped Prueba Extranjero', tipo_documento: 'PASAPORTE', numero_documento: 'PRUEBAX123', nacionalidad: 'Venezuela', es_menor: false, telefono },
  autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 45000 },
} });

describe('BD-18 — teléfono de otro país (API y base)', () => {
  it('+58 de Venezuela: se registra la entrada con ese teléfono', async () => {
    const r = await entrar('206', '+584121234567');
    assert.equal(r.statusCode, 201, r.body);
    const [h] = await e.bd.consultar<{ telefono: string }>('SELECT h.telefono FROM huespedes h JOIN estadias s ON s.huesped_id = h.id WHERE s.id = $1', [r.json().id]);
    assert.equal(h.telefono, '+584121234567');
  });

  it('sin el código del país o con letras: 400', async () => {
    assert.equal((await entrar('208', '4121234567')).statusCode, 400);
    assert.equal((await entrar('208', '+58abc')).statusCode, 400);
    assert.equal((await entrar('208', '+0412123')).statusCode, 400);
  });
});

describe('BD-18 — teléfono de otro país (pantalla)', () => {
  const base = { ...HUESPED_VACIO, nombre: 'Huésped Prueba 41', tipoDocumento: 'CC', numeroDocumento: 'PRUEBA0041', autorizo: true };
  it('con + y el código del país se acepta y se envía tal cual, sin espacios', () => {
    assert.deepEqual(erroresHuesped({ ...base, telefono: '+58 412 123 4567' }), {});
    assert.equal(aHuespedInput({ ...base, telefono: '+58 412 123 4567' }).telefono, '+584121234567');
  });
  it('el celular colombiano sigue igual: 10 números que empiezan por 3, sin el +57', () => {
    assert.deepEqual(erroresHuesped({ ...base, telefono: '300 123 4567' }), {});
    assert.equal(aHuespedInput({ ...base, telefono: '300 123 4567' }).telefono, '+573001234567');
  });
  it('un número que no es ni colombiano ni con código de país: el mensaje explica los dos casos', () => {
    const msg = erroresHuesped({ ...base, telefono: '412 123' }).telefono;
    assert.match(msg ?? '', /empieza por 3/);
    assert.match(msg ?? '', /\+ y el código del país/);
  });
});
