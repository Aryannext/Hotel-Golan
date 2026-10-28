// HG-HAL-001 HAL-07 · si una consulta falla (sin señal), la pantalla no puede decir «Todo al día»: dice qué no se pudo
// revisar, para que la administración no crea que no hay transferencias por confirmar ni extranjeros por reportar.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { marcarFuente, textoSinRevisar, TODO_AL_DIA, textoVacioAvisos, TRANSFERENCIAS_SIN_REVISAR } from './avisos.ts';

describe('HAL-07 — lo que no se pudo revisar', () => {
  it('marcarFuente agrega la que falló una sola vez y la quita cuando vuelve a responder', () => {
    let f = marcarFuente([], 'transferencias', false);
    f = marcarFuente(f, 'transferencias', false);
    f = marcarFuente(f, 'migracion', false);
    assert.deepEqual(f, ['transferencias', 'migracion']);
    assert.deepEqual(marcarFuente(f, 'transferencias', true), ['migracion']);
    assert.deepEqual(marcarFuente([], 'reglas', true), []);
  });

  it('textoSinRevisar nombra en palabras lo que falta, en el orden en que falló', () => {
    assert.equal(textoSinRevisar([]), '');
    assert.equal(textoSinRevisar(['migracion']),
      'No se pudieron revisar los reportes a Migración. Revise el internet: el sistema vuelve a intentar solo.');
    assert.equal(textoSinRevisar(['transferencias', 'reglas', 'existencias']),
      'No se pudieron revisar las transferencias por confirmar, las salidas vencidas y las existencias. Revise el internet: el sistema vuelve a intentar solo.');
  });

  it('la campana dice «Todo al día» solo si no hay avisos y todo se pudo revisar', () => {
    assert.equal(textoVacioAvisos([]), TODO_AL_DIA);
    assert.match(TODO_AL_DIA, /^Todo al día/);
    assert.equal(textoVacioAvisos(['habitaciones']), textoSinRevisar(['habitaciones']));
    assert.doesNotMatch(textoVacioAvisos(['habitaciones']), /Todo al día/);
  });

  it('«Por confirmar» sin respuesta no dice que no hay transferencias', () => {
    assert.doesNotMatch(TRANSFERENCIAS_SIN_REVISAR, /Todo al día/);
    assert.match(TRANSFERENCIAS_SIN_REVISAR, /No se pudieron consultar las transferencias/);
  });
});
