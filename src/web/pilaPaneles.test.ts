// HG-HAL-001 HAL-13 (A11Y-11) · con un panel abierto encima de otro (Anular sobre la ficha), Escape cierra solo el de
// encima: antes los dos escuchaban la tecla y se perdía el motivo escrito. Y el fondo se libera al cerrar el último.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearPila } from './pilaPaneles.ts';

describe('HAL-13 — paneles apilados', () => {
  it('Escape cierra solo el panel de encima', () => {
    const pila = crearPila();
    const cerrados: string[] = [];
    pila.abrir(() => cerrados.push('ficha'));
    pila.abrir(() => cerrados.push('anular'));
    pila.escape();
    assert.deepEqual(cerrados, ['anular']);
  });

  it('al quitar el de encima, Escape cierra el de abajo; sin paneles no hace nada', () => {
    const pila = crearPila();
    const cerrados: string[] = [];
    pila.abrir(() => cerrados.push('ficha'));
    const quitarAnular = pila.abrir(() => cerrados.push('anular'));
    quitarAnular();
    pila.escape();
    assert.deepEqual(cerrados, ['ficha']);
    assert.equal(pila.abiertos(), 1);
  });

  it('cuenta los abiertos, para liberar el fondo solo cuando se cierra el último', () => {
    const pila = crearPila();
    const a = pila.abrir(() => undefined);
    const b = pila.abrir(() => undefined);
    assert.equal(pila.abiertos(), 2);
    a();
    assert.equal(pila.abiertos(), 1);
    b();
    assert.equal(pila.abiertos(), 0);
    pila.escape();
  });
});
