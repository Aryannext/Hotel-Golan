// TICKET-27 · formulario «Cobrar un daño» (solo la administración; RN-18, V5-06).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { leerDano, AVISO_DANO_RECEPCION } from './danos.ts';

describe('RN-18 — daño con valor de reposición', () => {
  it('lee la descripción y el valor en pesos', () => {
    assert.deepEqual(leerDano('  Toalla manchada ', '25.000'), { ok: true, descripcion: 'Toalla manchada', valor: 25000 });
  });
  it('pide qué se dañó y un valor mayor que $0', () => {
    assert.deepEqual(leerDano('', '25000'), { ok: false, error: 'Escriba qué se dañó (por ejemplo, «Vaso roto»).' });
    assert.deepEqual(leerDano('Vaso roto', '0'), { ok: false, error: 'Escriba cuánto cuesta reponerlo, como nuevo.' });
    assert.deepEqual(leerDano('Vaso roto', 'abc'), { ok: false, error: 'Escriba cuánto cuesta reponerlo, como nuevo.' });
  });
  it('recepción ve que el daño lo cobra la administradora', () => {
    assert.match(AVISO_DANO_RECEPCION, /administradora/);
  });
});
