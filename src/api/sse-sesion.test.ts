// HG-HAL-001 HAL-25 · la conexión en vivo (SSE) se cierra cuando su sesión se cierra o se revoca: antes seguía
// recibiendo eventos aunque el usuario hubiera salido o lo hubieran desactivado. Se revisa en cada latido.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Bd } from '../../scripts/lib/bd.ts';
import { aplicarMigraciones } from '../../scripts/lib/migraciones.ts';
import { sembrar } from '../../scripts/lib/semilla.ts';
import { construirApp, type App } from './app.ts';
import { PIN_PRUEBA, baseDePrueba } from './pruebas/entorno.ts';

let bd: Bd;
let borrar: () => Promise<void>;
let app: App;
let base: string;
before(async () => {
  ({ bd, borrar } = await baseDePrueba());
  await aplicarMigraciones(bd);
  await sembrar(bd, PIN_PRUEBA);
  app = await construirApp({ bd, latidoMs: 150 });
  await app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/v1`;
});
after(async () => { await app.close(); await borrar(); });

async function entrar(usuario: string) {
  const r = await fetch(`${base}/sesiones`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario, pin: PIN_PRUEBA }) });
  return (r.headers.get('set-cookie') ?? '').split(';')[0];
}

/** Abre /eventos y resuelve cuando el servidor cierra la conexión (o falla por tiempo). */
async function abrir(cookie: string) {
  const r = await fetch(`${base}/eventos`, { headers: { cookie, accept: 'text/event-stream' } });
  assert.equal(r.status, 200);
  const lector = r.body!.getReader();
  return (msMaximo: number) => Promise.race([
    (async () => { for (;;) { const { done } = await lector.read(); if (done) return 'cerrada'; } })(),
    new Promise<string>((res) => setTimeout(() => { res('abierta'); void lector.cancel(); }, msMaximo)),
  ]);
}

describe('HAL-25 — SSE con la sesión cerrada', () => {
  it('al cerrar la sesión, el servidor cierra su conexión en vivo', async () => {
    const cookie = await entrar('recepcion1');
    const esperarCierre = await abrir(cookie);
    await fetch(`${base}/sesiones/actual`, { method: 'DELETE', headers: { cookie } });
    assert.equal(await esperarCierre(2000), 'cerrada');
  });

  it('con la sesión vigente, la conexión sigue abierta', async () => {
    const cookie = await entrar('recepcion2');
    const esperarCierre = await abrir(cookie);
    assert.equal(await esperarCierre(600), 'abierta');
  });
});
