// TICKET-25 · solicitudes de factura en la PWA: revisar los datos, enviarlos limpios y mostrar el estado en palabras.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aSolicitudInput, erroresFactura, estadoFactura, fechaLarga, siguientePaso } from './facturas.ts';

const base = { documento: '900.123.456-7', correo: '', telefono: '' };

describe('FR-28 — datos de la solicitud', () => {
  it('el RUT o NIT con el correo o con el celular basta', () => {
    assert.deepEqual(erroresFactura({ ...base, correo: 'factura.prueba@ejemplo.test' }), {});
    assert.deepEqual(erroresFactura({ ...base, telefono: '300 000 0002' }), {});
  });

  it('sin correo ni celular, pide uno de los dos', () => {
    assert.ok(erroresFactura(base).correo);
  });

  it('marca el RUT, el correo o el celular mal escritos', () => {
    assert.ok(erroresFactura({ ...base, documento: '', correo: 'a@b.co' }).documento);
    assert.ok(erroresFactura({ ...base, documento: 'NIT ABC', correo: 'a@b.co' }).documento);
    assert.ok(erroresFactura({ ...base, correo: 'sin-arroba' }).correo);
    assert.ok(erroresFactura({ ...base, telefono: '300 12' }).telefono);
  });

  it('envía el RUT sin puntos ni espacios, el celular con +57 y omite lo vacío', () => {
    assert.deepEqual(aSolicitudInput({ documento: ' 900.123.456 - 7 ', correo: ' Factura.Prueba@Ejemplo.test ', telefono: '' }),
      { documento: '900123456-7', correo: 'Factura.Prueba@Ejemplo.test' });
    assert.deepEqual(aSolicitudInput({ documento: '12.345.678', correo: '', telefono: '300 000 0002' }),
      { documento: '12345678', telefono: '+573000000002' });
  });
});

describe('FR-28 — estado y fecha prevista en palabras', () => {
  it('cada estado con su etiqueta', () => {
    assert.deepEqual(estadoFactura('PENDIENTE'), ['pill--aviso', 'Por pasar al contador']);
    assert.deepEqual(estadoFactura('ENVIADA_AL_CONTADOR'), ['pill--info', 'Con el contador']);
    assert.deepEqual(estadoFactura('ENTREGADA'), ['pill--exito', 'Entregada']);
  });

  it('la fecha prevista con el día de la semana', () => {
    assert.equal(fechaLarga('2026-10-19'), 'lunes 19 de octubre');
    assert.equal(fechaLarga('2026-11-17'), 'martes 17 de noviembre');
  });

  it('el siguiente paso solo lo da la administración, en orden', () => {
    assert.deepEqual(siguientePaso('PENDIENTE'), { estado: 'ENVIADA_AL_CONTADOR', texto: 'Ya se la pasé al contador' });
    assert.deepEqual(siguientePaso('ENVIADA_AL_CONTADOR'), { estado: 'ENTREGADA', texto: 'El contador ya la envió' });
    assert.equal(siguientePaso('ENTREGADA'), null);
  });
});
