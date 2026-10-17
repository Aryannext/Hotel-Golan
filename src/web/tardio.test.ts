// TICKET-18 · registro tardío en la PWA (ADR-010): la hora real de entrada se escribe en hora de Bogotá,
// aunque el celular esté en otra zona horaria.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aLocalBogota, entradaIso, errorTardio, limitesTardio, textoTardio } from './tardio.ts';

const ahora = Date.parse('2026-10-13T06:10:00-05:00');

describe('ADR-010 — registro tardío en la PWA', () => {
  it('convierte a la hora de Bogotá para el campo de fecha y hora', () => {
    assert.equal(aLocalBogota(ahora), '2026-10-13T06:10');
    assert.equal(aLocalBogota(Date.parse('2026-10-13T02:30:00Z')), '2026-10-12T21:30');
  });

  it('el campo solo deja elegir entre hace 48 horas y ahora', () => {
    assert.deepEqual(limitesTardio(ahora), { min: '2026-10-11T06:10', max: '2026-10-13T06:10' });
  });

  it('lo escrito se envía con el desfase de Bogotá; lo que no es una fecha real no se envía', () => {
    assert.equal(entradaIso('2026-10-13T03:10'), '2026-10-13T03:10:00-05:00');
    assert.equal(entradaIso(''), null);
    assert.equal(entradaIso('2026-02-30T10:00'), null);
    assert.equal(entradaIso('13/10/2026 3:10'), null);
  });

  it('avisa en palabras si falta la hora, si es futura o si pasó de 48 horas', () => {
    assert.match(errorTardio('', ahora)!, /hora real/);
    assert.match(errorTardio('2026-10-13T06:20', ahora)!, /todavía no ha pasado/);
    assert.match(errorTardio('2026-10-11T06:00', ahora)!, /48 horas/);
    assert.equal(errorTardio('2026-10-11T06:10', ahora), null);
    assert.equal(errorTardio('2026-10-13T03:10', ahora), null);
  });

  it('la ficha dice cuándo entró y quién lo digitó', () => {
    assert.equal(textoTardio({ entrada_en: '2026-10-13T03:10:00-05:00', registrada_por: 'recepcion2', registrada_en: '2026-10-13T06:10:00-05:00' }),
      'Registro tardío: entró el 13/10/2026 a las 3:10 a. m.; lo digitó recepcion2 el 13/10/2026 a las 6:10 a. m.');
  });
});
