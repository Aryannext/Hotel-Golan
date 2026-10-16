// TICKET-08 · POST /estadias/{id}/salida (FR-09; RN-07) y PUT /habitaciones/{numero}/estado (FR-02) según docs/CONTRATO_API.yaml.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T11:40:00-05:00');
  cookie = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

const estadiaDe = async (hab: string) =>
  (await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = $1 ORDER BY entrada_en DESC LIMIT 1`, [hab]))[0].id;
const salida = (id: string, c: string | null = cookie) =>
  e.app.inject({ method: 'POST', url: `/api/v1/estadias/${id}/salida`, headers: c ? { cookie: c } : {} });
const cambiar = (numero: string, payload: Record<string, unknown>) =>
  e.app.inject({ method: 'PUT', url: `/api/v1/habitaciones/${numero}/estado`, payload, headers: { cookie } });
const habitacion = async (n: string) =>
  (await e.bd.consultar<{ estado: string; nota: string | null }>('SELECT estado, nota FROM habitaciones WHERE numero = $1', [n]))[0];

describe('RN-07, FR-09 — Nadie sale debiendo', () => {
  it('sin sesión: 401', async () => {
    assert.equal((await salida(await estadiaDe('205'), null)).statusCode, 401);
  });

  it('salida bloqueada por saldo: 409 SALDO_PENDIENTE y la estadía sigue ACTIVA', async () => {
    const r = await salida(await estadiaDe('211'));
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().codigo, 'SALDO_PENDIENTE');
    assert.match(r.json().mensaje, /\$28\.000/);
    const [s] = await e.bd.consultar<{ estado: string }>('SELECT estado FROM estadias WHERE id = $1', [await estadiaDe('211')]);
    assert.equal(s.estado, 'ACTIVA');
    assert.equal((await habitacion('211')).estado, 'OCUPADA');
  });

  it('salida con la cuenta al día: CERRADA con hora real y la habitación queda POR_REVISAR', async () => {
    const id = await estadiaDe('205');
    const r = await salida(id);
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().id, r.json().estado, r.json().salida_real_en], [id, 'CERRADA', '2026-10-13T11:40:00-05:00']);
    assert.deepEqual(await habitacion('205'), { estado: 'POR_REVISAR', nota: 'Salió a las 11:40 a. m.' });
    const ev = await e.bd.consultar<{ tipo: string }>(
      `SELECT tipo FROM eventos_salida WHERE tipo IN ('estadia.cerrada', 'habitacion.actualizada') AND (payload->>'entidad_id' = $1 OR payload->>'numero' = '205') ORDER BY id`, [id]);
    assert.deepEqual(ev.map((x) => x.tipo), ['estadia.cerrada', 'habitacion.actualizada']);
    const [a] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM auditoria WHERE accion = 'ACTUALIZAR' AND entidad = 'estadias' AND entidad_id = $1`, [id]);
    assert.equal(a.n, 1);
  });

  it('una estadía ya cerrada no sale dos veces (409); una que no existe: 404', async () => {
    assert.equal((await salida(await estadiaDe('205'))).json().codigo, 'CONFLICTO');
    assert.equal((await salida('00000000-0000-4000-8000-000000000000')).statusCode, 404);
  });

  it('con una transferencia por verificar y saldo $0 sí puede salir (la habitación se entrega igual, RN-12)', async () => {
    const r = await e.app.inject({
      method: 'POST', url: '/api/v1/estadias', headers: { cookie },
      payload: {
        habitacion_numero: '209', modalidad: 'TRES_HORAS', personas: 2, huesped: { nombre: 'Huésped Prueba 70', nacionalidad: 'Colombia', es_menor: false },
        autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'NEQUI' },
      },
    });
    assert.equal(r.statusCode, 201);
    assert.equal((await salida(r.json().id)).statusCode, 200);
  });
});

describe('FR-02 — Revisión y transiciones de la habitación', () => {
  it('la habitación por revisar no se puede asignar', async () => {
    const r = await e.app.inject({
      method: 'POST', url: '/api/v1/estadias', headers: { cookie },
      payload: {
        habitacion_numero: '205', modalidad: 'NOCHE', personas: 1, huesped: { nombre: 'Huésped Prueba 71', nacionalidad: 'Colombia', es_menor: false },
        autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'AL_SALIR' },
      },
    });
    assert.equal(r.json().codigo, 'HABITACION_NO_DISPONIBLE');
  });

  it('por revisar → limpieza especial (fluidos) → disponible', async () => {
    const r = await cambiar('205', { estado: 'LIMPIEZA', limpieza_especial: true });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json(), { numero: '205', tipo: 'VENTILADOR', estado: 'LIMPIEZA', nota: 'Limpieza especial (fluidos)', estadia_activa: null });
    const d = await cambiar('205', { estado: 'DISPONIBLE' });
    assert.equal(d.statusCode, 200);
    assert.deepEqual([d.json().estado, d.json().nota], ['DISPONIBLE', null]);
    const [a] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM auditoria WHERE accion = 'ACTUALIZAR' AND entidad = 'habitaciones' AND entidad_id = '205'`);
    assert.equal(a.n, 2);
  });

  it('por revisar → limpieza normal deja la nota «Limpieza normal»', async () => {
    const r = await cambiar('209', { estado: 'LIMPIEZA' });
    assert.deepEqual([r.json().estado, r.json().nota], ['LIMPIEZA', 'Limpieza normal']);
  });

  it('por revisar → mantenimiento con la nota del daño → por revisar cuando se arregla', async () => {
    const m = await cambiar('207', { estado: 'MANTENIMIENTO', nota: 'La ducha gotea' });
    assert.deepEqual([m.statusCode, m.json().estado, m.json().nota], [200, 'MANTENIMIENTO', 'La ducha gotea']);
    const r = await cambiar('207', { estado: 'POR_REVISAR' });
    assert.deepEqual([r.json().estado, r.json().nota], ['POR_REVISAR', 'Arreglada: revisar antes de ofrecerla']);
    const [ev] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM eventos_salida WHERE tipo = 'habitacion.actualizada' AND payload->>'numero' = '207'`);
    assert.equal(ev.n, 2);
  });

  it('transiciones no permitidas: 409 TRANSICION_INVALIDA', async () => {
    for (const [n, estado] of [['201', 'LIMPIEZA'], ['211', 'DISPONIBLE'], ['204', 'MANTENIMIENTO'], ['207', 'DISPONIBLE'], ['201', 'DISPONIBLE']]) {
      const r = await cambiar(n, { estado });
      assert.equal(r.statusCode, 409, `${n} → ${estado}`);
      assert.equal(r.json().codigo, 'TRANSICION_INVALIDA');
    }
    assert.equal((await habitacion('211')).estado, 'OCUPADA');
  });

  it('OCUPADA no se pide a mano, limpieza especial solo con LIMPIEZA y habitación inexistente: 400', async () => {
    assert.equal((await cambiar('201', { estado: 'OCUPADA' })).statusCode, 400);
    assert.equal((await cambiar('207', { estado: 'MANTENIMIENTO', limpieza_especial: true })).statusCode, 400);
    assert.equal((await cambiar('101', { estado: 'LIMPIEZA' })).statusCode, 400);
  });
});
