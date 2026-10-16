// TICKET-01 · FR-19, FR-20, ADR-003. Escenarios «FR-19 — Inicio de sesión» de docs/TESTS_ACEPTACION.feature.
import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
before(async () => { e = await crearEntorno(); });
after(async () => e.cerrar());
beforeEach(() => e.fijarHora('2026-10-13T06:10:00-05:00'));

const entrar = (usuario: string, pin: string) =>
  e.app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { usuario, pin } });

describe('FR-19 — Inicio de sesión', () => {
  it('PIN correcto: 201 y cookie HttpOnly, Secure, SameSite=Strict de 12 horas', async () => {
    const r = await entrar('recepcion1', '135790');
    assert.equal(r.statusCode, 201);
    const c = r.cookies.find((x) => x.name === 'sesion');
    assert.ok(c, 'falta la cookie sesion');
    assert.equal(c.httpOnly, true);
    assert.equal(c.secure, true);
    assert.equal(c.sameSite, 'Strict');
    assert.equal(c.maxAge, 12 * 3600);
    const cuerpo = r.json();
    assert.equal(cuerpo.usuario.usuario, 'recepcion1');
    assert.equal(cuerpo.usuario.rol, 'RECEPCION');
    assert.equal(cuerpo.turno_por_recibir, false);
    assert.equal(cuerpo.expira_en, '2026-10-13T18:10:00-05:00');
    assert.equal('pin_hash' in cuerpo.usuario, false);
  });

  it('el token se guarda como hash, no en claro', async () => {
    const r = await entrar('recepcion1', '135790');
    const token = r.cookies.find((x) => x.name === 'sesion')!.value;
    const filas = await e.bd.consultar<{ n: number }>('SELECT count(*)::int n FROM sesiones WHERE token_hash = $1', [token]);
    assert.equal(filas[0].n, 0);
  });

  it('PIN incorrecto y usuario inexistente responden igual: 401 CREDENCIALES_INVALIDAS', async () => {
    for (const r of [await entrar('recepcion3', '000000'), await entrar('no-existe', '135790')]) {
      assert.equal(r.statusCode, 401);
      assert.equal(r.json().codigo, 'CREDENCIALES_INVALIDAS');
      assert.match(r.json().mensaje, /usuario o el PIN/i);
    }
  });

  it('PIN que no tiene 6 dígitos: 400 INVALID_PAYLOAD', async () => {
    const r = await entrar('recepcion1', '1234');
    assert.equal(r.statusCode, 400);
    assert.equal(r.json().codigo, 'INVALID_PAYLOAD');
  });

  it('bloqueo tras 5 intentos fallidos durante 15 minutos, aunque el PIN sea correcto', async () => {
    for (let i = 1; i <= 4; i++) assert.equal((await entrar('recepcion4', '111111')).statusCode, 401);
    const quinto = await entrar('recepcion4', '111111');
    assert.equal(quinto.statusCode, 401);
    assert.equal(quinto.json().codigo, 'CREDENCIALES_INVALIDAS');
    const bloqueado = await entrar('recepcion4', '135790');
    assert.equal(bloqueado.statusCode, 423);
    assert.equal(bloqueado.json().codigo, 'USUARIO_BLOQUEADO');
    e.avanzarMinutos(14);
    assert.equal((await entrar('recepcion4', '135790')).statusCode, 423);
    e.avanzarMinutos(2);
    assert.equal((await entrar('recepcion4', '135790')).statusCode, 201);
  });

  it('un usuario desactivado no puede entrar', async () => {
    await e.bd.consultar(`UPDATE usuarios SET activo = false WHERE usuario = 'recepcion3'`);
    try {
      const r = await entrar('recepcion3', '135790');
      assert.equal(r.statusCode, 401);
    } finally {
      await e.bd.consultar(`UPDATE usuarios SET activo = true WHERE usuario = 'recepcion3'`);
    }
  });

  it('registra INICIAR_SESION y BLOQUEAR en auditoría sin el PIN', async () => {
    const filas = await e.bd.consultar<{ accion: string; detalle: unknown }>(
      `SELECT accion, detalle FROM auditoria WHERE accion IN ('INICIAR_SESION', 'BLOQUEAR')`);
    assert.ok(filas.some((f) => f.accion === 'INICIAR_SESION'));
    assert.ok(filas.some((f) => f.accion === 'BLOQUEAR'));
    assert.ok(!JSON.stringify(filas).includes('135790'));
  });
});

describe('Sesión actual', () => {
  it('sin cookie: 401 NO_AUTENTICADO', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual' });
    assert.equal(r.statusCode, 401);
    assert.equal(r.json().codigo, 'NO_AUTENTICADO');
  });

  it('con cookie: 200 con el usuario', async () => {
    const cookie = await e.entrar('admin');
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual', headers: { cookie } });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().usuario.rol, 'ADMINISTRACION');
  });

  it('vence a las 12 horas', async () => {
    const cookie = await e.entrar('recepcion2');
    e.avanzarMinutos(12 * 60 + 1);
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual', headers: { cookie } });
    assert.equal(r.statusCode, 401);
  });

  it('cerrar sesión: 204 y la cookie deja de servir', async () => {
    const cookie = await e.entrar('recepcion2');
    const r = await e.app.inject({ method: 'DELETE', url: '/api/v1/sesiones/actual', headers: { cookie } });
    assert.equal(r.statusCode, 204);
    const despues = await e.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual', headers: { cookie } });
    assert.equal(despues.statusCode, 401);
  });
});

describe('Errores comunes', () => {
  it('ruta inexistente: 404 NO_ENCONTRADO en JSON', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/no-existe' });
    assert.equal(r.statusCode, 404);
    assert.equal(r.json().codigo, 'NO_ENCONTRADO');
  });
});
