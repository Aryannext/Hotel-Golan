// HG-HAL-001 HAL-10 · el bloqueo tras 5 PIN incorrectos (FR-19, ADR-003) no se salta enviando los intentos en paralelo:
// cada intento se reserva antes de verificar el PIN, así que nunca se verifican más de 5 por bloqueo. Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, PIN_PRUEBA, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
before(async () => { e = await crearEntorno(); });
after(async () => e.cerrar());

const entrar = (usuario: string, pin: string) => e.app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { usuario, pin } });

describe('HAL-10 — intentos en paralelo', () => {
  it('10 PIN incorrectos a la vez: a lo sumo 5 se verifican (401) y el resto queda bloqueado (423)', async () => {
    const r = await Promise.all(Array.from({ length: 10 }, (_, i) => entrar('recepcion1', String(100000 + i))));
    const estados = r.map((x) => x.statusCode);
    assert.ok(estados.filter((s) => s === 401).length <= 5, `401: ${estados.join(',')}`);
    assert.equal(estados.filter((s) => s === 401).length + estados.filter((s) => s === 423).length, 10, estados.join(','));
  });

  it('después de eso, ni el PIN correcto entra hasta que pase el bloqueo', async () => {
    assert.equal((await entrar('recepcion1', PIN_PRUEBA)).statusCode, 423);
    e.avanzarMinutos(16);
    assert.equal((await entrar('recepcion1', PIN_PRUEBA)).statusCode, 201);
  });

  it('el PIN correcto entre intentos fallidos entra y deja el contador en cero', async () => {
    await entrar('recepcion2', '111111');
    await entrar('recepcion2', '222222');
    assert.equal((await entrar('recepcion2', PIN_PRUEBA)).statusCode, 201);
    const [u] = await e.bd.consultar<{ intentos_fallidos: number }>(`SELECT intentos_fallidos FROM usuarios WHERE usuario = 'recepcion2'`);
    assert.equal(u.intentos_fallidos, 0);
  });
});
