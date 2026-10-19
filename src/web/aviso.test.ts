// TICKET-28 · aviso de privacidad en la entrada (FR-05; RN-16; ADR-006). El texto corto lo aprobó la dueña el 18-10-2026
// (HG-ACT-001 V6-09); los datos del hotel salen de Ajustes. Datos sintéticos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TEXTO_CORTO, erroresDatosHotel, faltantesHotel, politica, type DatosHotel } from './aviso.ts';

const vacio: DatosHotel = { responsable: null, nit: null, rnt: null, direccion: null, telefono: null };
const completo: DatosHotel = { responsable: 'Responsable Prueba', nit: '12.345.678-9', rnt: '12345', direccion: 'Calle Prueba # 1-23', telefono: '3001234567' };
const textoDe = (d: DatosHotel, dias = 90) => politica(d, dias).flatMap((s) => [s.titulo, ...s.parrafos]).join('\n');

describe('TICKET-28 — aviso de privacidad', () => {
  it('el texto corto es el aprobado: obligación legal, Migración, recepción y la pregunta final', () => {
    const t = TEXTO_CORTO.join(' ');
    assert.match(t, /^Para hospedarse, la ley nos exige registrar a cada huésped\./);
    assert.match(t, /reportar su llegada y su salida a Migración Colombia/);
    assert.match(t, /hablando con la recepción del hotel/);
    assert.match(t, /¿Nos autoriza el tratamiento de sus datos\?$/);
  });

  it('dice qué datos del hotel faltan en Ajustes', () => {
    assert.deepEqual(faltantesHotel(vacio), ['el responsable', 'el NIT', 'el Registro Nacional de Turismo', 'la dirección', 'el teléfono']);
    assert.deepEqual(faltantesHotel(completo), []);
  });

  it('la política completa usa los datos del hotel y el plazo de borrado configurado', () => {
    const t = textoDe(completo, 90);
    for (const dato of ['Responsable Prueba', '12.345.678-9', '12345', 'Calle Prueba # 1-23', '300 123 4567', '90 días']) assert.ok(t.includes(dato), dato);
    assert.match(t, /Ley 2068 de 2020/);
    assert.match(t, /10 días hábiles/);
  });

  it('si falta un dato, lo marca en lugar de inventarlo', () => {
    assert.match(textoDe(vacio), /\(falta en Ajustes\)/);
  });

  it('valida los datos del formulario de Ajustes', () => {
    assert.deepEqual(erroresDatosHotel({ ...completo }), {});
    const e = erroresDatosHotel({ ...completo, telefono: '12', rnt: 'ABC' });
    assert.deepEqual(Object.keys(e).sort(), ['rnt', 'telefono']);
  });
});
