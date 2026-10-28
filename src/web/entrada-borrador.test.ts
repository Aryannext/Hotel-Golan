// DEF-002 (CF35) · la entrada a medio llenar no se pierde sin aviso: «Volver» o «Cancelar» preguntan antes de borrar
// lo escrito, y solo si hay algo escrito. Datos sintéticos.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HUESPED_VACIO, PREGUNTA_SALIR_ENTRADA, entradaEmpezada } from './logica.ts';

describe('DEF-002 — salir del asistente de entrada', () => {
  it('sin nada escrito, en el paso 1, se sale sin preguntar', () => {
    assert.equal(entradaEmpezada(HUESPED_VACIO, 1), false);
  });

  it('con el nombre, el documento o el teléfono escritos, pregunta', () => {
    assert.equal(entradaEmpezada({ ...HUESPED_VACIO, nombre: 'Huésped Prueba CF35' }, 1), true);
    assert.equal(entradaEmpezada({ ...HUESPED_VACIO, numeroDocumento: 'PRUEBA0001' }, 1), true);
    assert.equal(entradaEmpezada({ ...HUESPED_VACIO, telefono: '3000000000' }, 1), true);
  });

  it('espacios sueltos no cuentan como escrito', () => {
    assert.equal(entradaEmpezada({ ...HUESPED_VACIO, nombre: '   ' }, 1), false);
  });

  it('desde el paso 2 ya hay datos del huésped: pregunta', () => {
    assert.equal(entradaEmpezada(HUESPED_VACIO, 2), true);
  });

  it('la pregunta dice qué se pierde, en palabras sencillas', () => {
    assert.match(PREGUNTA_SALIR_ENTRADA, /¿Salir sin registrar la entrada\?/);
    assert.match(PREGUNTA_SALIR_ENTRADA, /se borra lo que escribió/);
  });
});
