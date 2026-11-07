// HG-HAL-001 HAL-32 · el publicador SSE no se atasca: si un cliente falla al recibir (conexión ya cerrada), los demás
// reciben el evento igual, el evento queda publicado y ese cliente sale de la lista.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';
import { Publicador } from './tiempo_real/eventos.ts';

let e: Entorno;
before(async () => { e = await crearEntorno(); });
after(async () => e.cerrar());

describe('HAL-32 — un cliente que falla no frena a los demás', () => {
  it('el evento llega al cliente sano, queda publicado y el roto sale de la lista', async () => {
    const errores: unknown[] = [];
    const p = new Publicador(e.bd, (x) => errores.push(x), 60_000);
    const recibidos: string[] = [];
    let intentosRoto = 0;
    await p.suscribir({ rol: 'RECEPCION', ultimoId: 0n, enviar: () => { intentosRoto++; throw new Error('conexión cerrada'); } }, null);
    await p.suscribir({ rol: 'RECEPCION', ultimoId: 0n, enviar: (t) => { recibidos.push(t); } }, null);
    await e.bd.consultar(`UPDATE eventos_salida SET publicado_en = now() WHERE publicado_en IS NULL`);
    await e.bd.consultar(`INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ('habitacion.actualizada', '{"numero":"201"}', now())`);
    await e.bd.consultar(`INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ('habitacion.actualizada', '{"numero":"202"}', now())`);
    p.despertar();
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(recibidos.length, 2, `recibió ${recibidos.length}; errores: ${errores.length}`);
    assert.equal(intentosRoto, 1, 'el cliente roto sale de la lista al primer fallo');
    const [{ n }] = await e.bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM eventos_salida WHERE publicado_en IS NULL');
    assert.equal(n, 0);
    p.cerrar();
  });
});
