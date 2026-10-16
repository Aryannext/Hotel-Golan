// TICKET-03 · GET /turnos/actual y POST /turnos/actual/recepcion (FR-11, FR-14; RN-09, RN-10, RN-11) según docs/CONTRATO_API.yaml.
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';
import { turnoAbiertoId } from './caja/turnos.ts';
import { ErrorApi } from './comun/errores.ts';

const id = async (e: Entorno, usuario: string) =>
  (await e.bd.consultar<{ id: string }>('SELECT id FROM usuarios WHERE usuario = $1', [usuario]))[0].id;

/** Cierra el turno de noche de la semilla (lo tenía recepcion1) y deja uno de día POR_RECIBIR con base_entregada 184.500. */
async function dejarTurnoPorRecibir(e: Entorno): Promise<string> {
  const r1 = await id(e, 'recepcion1');
  await e.bd.consultar(
    `UPDATE turnos SET estado = 'CERRADO', responsable_id = $2, fin_en = '2026-10-13T06:30:00-05:00',
            pago_tomado = true, efectivo_esperado = 184500, efectivo_contado = 184500 WHERE id = $1`,
    [e.semilla.turnoId, r1]);
  const [t] = await e.bd.consultar<{ id: string }>(
    `INSERT INTO turnos (tipo, estado, recibido_de_id, inicio_en, base_entregada, pago_turno)
     VALUES ('DIA', 'POR_RECIBIR', $1, '2026-10-13T06:30:00-05:00', 184500, 70000) RETURNING id`, [r1]);
  return t.id;
}

describe('RN-10, FR-11 — La caja del turno solo suma efectivo', () => {
  let e: Entorno;
  let cookie: string;
  before(async () => { e = await crearEntorno(); cookie = await e.entrar('recepcion2'); });
  after(async () => e.cerrar());
  const actual = (c: string | null = cookie) => e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: c ? { cookie: c } : {} });

  it('sin sesión: 401', async () => {
    assert.equal((await actual(null)).statusCode, 401);
  });

  it('caja del ejemplo real del relevo: 208.500 + 26.000 = 234.500; transferencias 85.000 aparte', async () => {
    const r = await actual();
    assert.equal(r.statusCode, 200);
    const t = r.json();
    assert.equal(t.id, e.semilla.turnoId);
    assert.deepEqual(
      [t.tipo, t.estado, t.responsable, t.recibido_de, t.base_entregada, t.base_recibida, t.fin_en, t.cierre],
      ['NOCHE', 'ABIERTO', 'recepcion2', 'recepcion1', 208500, 208500, null, null]);
    assert.equal(t.inicio_en, '2026-10-12T18:30:00-05:00');
    assert.equal(t.fin_programado_en, '2026-10-13T06:30:00-05:00');
    assert.deepEqual(t.caja, {
      base_recibida: 208500, efectivo: 26000, salidas: 0, debe_haber: 234500,
      transferencias: 85000, por_verificar_cantidad: 1, pago_turno: 50000,
    });
  });

  it('la administración también ve la caja', async () => {
    const r = await actual(await e.entrar('admin'));
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().caja.debe_haber, 234500);
  });

  it('una salida de dinero baja «debe haber», pero el efectivo cobrado sigue igual', async () => {
    await e.bd.consultar(
      `INSERT INTO movimientos_caja (turno_id, tipo, detalle, valor, registrado_por) VALUES ($1, 'COMPRA_HOTEL', '2 jabones', 10000, $2)`,
      [e.semilla.turnoId, await id(e, 'recepcion2')]);
    const c = (await actual()).json().caja;
    assert.deepEqual([c.debe_haber, c.efectivo, c.salidas], [224500, 26000, 10000]);
  });

  it('lo anulado no cuenta y una transferencia rechazada no suma', async () => {
    const r2 = await id(e, 'recepcion2');
    const admin = await id(e, 'admin');
    await e.bd.consultar(
      `UPDATE movimientos_caja SET anulado_en = now(), anulado_por = $2, motivo_anulacion = 'registrado por error' WHERE turno_id = $1`,
      [e.semilla.turnoId, admin]);
    const [estadia] = await e.bd.consultar<{ id: string }>(`SELECT estadia_id AS id FROM pagos WHERE turno_id = $1 LIMIT 1`, [e.semilla.turnoId]);
    await e.bd.consultar(
      `INSERT INTO pagos (estadia_id, turno_id, medio, valor, estado, registrado_por, anulado_en, anulado_por, motivo_anulacion)
       VALUES ($1, $2, 'EFECTIVO', 9000, 'EN_CAJA', $3, now(), $4, 'cobro repetido')`, [estadia.id, e.semilla.turnoId, r2, admin]);
    await e.bd.consultar(
      `INSERT INTO pagos (estadia_id, turno_id, medio, valor, estado, registrado_por, verificado_por, verificado_en)
       VALUES ($1, $2, 'NEQUI', 15000, 'RECHAZADO', $3, $4, now())`, [estadia.id, e.semilla.turnoId, r2, admin]);
    const c = (await actual()).json().caja;
    assert.deepEqual([c.debe_haber, c.efectivo, c.salidas, c.transferencias, c.por_verificar_cantidad], [234500, 26000, 0, 85000, 1]);
  });
});

describe('RN-09, RN-11, FR-14 — Recibir el turno', () => {
  let e: Entorno;
  let turnoId: string;
  beforeEach(async () => {
    e = await crearEntorno();
    turnoId = await dejarTurnoPorRecibir(e);
    e.fijarHora('2026-10-13T06:35:00-05:00');
  });
  afterEach(async () => e.cerrar());
  const recibir = (cookie: string, payload: Record<string, unknown>) =>
    e.app.inject({ method: 'POST', url: '/api/v1/turnos/actual/recepcion', payload, headers: { cookie } });
  const eventos = (tipo: string) =>
    e.bd.consultar<{ payload: Record<string, unknown> }>('SELECT payload FROM eventos_salida WHERE tipo = $1', [tipo]);

  it('recibir el turno con un toque: queda ABIERTO con la base contada y el usuario como responsable', async () => {
    const cookie = await e.entrar('recepcion2');
    const r = await recibir(cookie, { base_contada: 184500 });
    assert.equal(r.statusCode, 200);
    const t = r.json();
    assert.deepEqual(
      [t.id, t.tipo, t.estado, t.responsable, t.recibido_de, t.base_entregada, t.base_recibida],
      [turnoId, 'DIA', 'ABIERTO', 'recepcion2', 'recepcion1', 184500, 184500]);
    assert.equal(t.inicio_en, '2026-10-13T06:35:00-05:00');
    assert.equal(t.fin_programado_en, '2026-10-13T18:30:00-05:00');
    assert.deepEqual(t.caja, {
      base_recibida: 184500, efectivo: 0, salidas: 0, debe_haber: 184500, transferencias: 0, por_verificar_cantidad: 0, pago_turno: 70000,
    });
    assert.equal((await eventos('turno.recibido')).length, 1);
    assert.equal((await eventos('turno.diferencia')).length, 0);
    const aud = await e.bd.consultar<{ n: number }>(
      `SELECT count(*)::int AS n FROM auditoria WHERE accion = 'RECIBIR_TURNO' AND entidad = 'turnos' AND entidad_id = $1`, [turnoId]);
    assert.equal(aud[0].n, 1);
  });

  it('antes de recibir, la sesión avisa que hay un turno por recibir; después ya no', async () => {
    const cookie = await e.entrar('recepcion2');
    const sesion = async () => (await e.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual', headers: { cookie } })).json();
    assert.equal((await sesion()).turno_por_recibir, true);
    await recibir(cookie, { base_contada: 184500 });
    assert.equal((await sesion()).turno_por_recibir, false);
  });

  it('el turno por recibir se puede consultar: muestra lo entregado y aún no tiene responsable', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie: await e.entrar('recepcion2') } });
    const t = r.json();
    assert.deepEqual([t.estado, t.responsable, t.base_entregada, t.base_recibida, t.caja.debe_haber], ['POR_RECIBIR', null, 184500, null, 184500]);
  });

  it('recibir con diferencia sin motivo: 422 MOTIVO_REQUERIDO y el turno sigue por recibir', async () => {
    const r = await recibir(await e.entrar('recepcion2'), { base_contada: 183000 });
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().codigo, 'MOTIVO_REQUERIDO');
    const [t] = await e.bd.consultar<{ estado: string }>('SELECT estado FROM turnos WHERE id = $1', [turnoId]);
    assert.equal(t.estado, 'POR_RECIBIR');
  });

  it('recibir con diferencia avisa a la administración (evento turno.diferencia)', async () => {
    const r = await recibir(await e.entrar('recepcion2'), { base_contada: 183000, motivo_diferencia: 'faltan 1.500 en monedas' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().estado, r.json().base_recibida, r.json().caja.debe_haber], ['ABIERTO', 183000, 183000]);
    const [f] = await e.bd.consultar<{ motivo: string }>('SELECT motivo_diferencia_recepcion AS motivo FROM turnos WHERE id = $1', [turnoId]);
    assert.equal(f.motivo, 'faltan 1.500 en monedas');
    const ev = await eventos('turno.diferencia');
    assert.equal(ev.length, 1);
    assert.deepEqual(ev[0].payload, { turno_id: turnoId, base_entregada: 184500, base_contada: 183000, diferencia: -1500, recibido_por: 'recepcion2' });
  });

  it('la administración no recibe turnos: 403', async () => {
    const r = await recibir(await e.entrar('admin'), { base_contada: 184500 });
    assert.equal(r.statusCode, 403);
    assert.equal(r.json().codigo, 'SIN_PERMISO');
  });

  it('un turno ya recibido no se vuelve a recibir: 409 CONFLICTO', async () => {
    await recibir(await e.entrar('recepcion2'), { base_contada: 184500 });
    const r = await recibir(await e.entrar('recepcion3'), { base_contada: 184500 });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().codigo, 'CONFLICTO');
  });

  it('valor contado negativo o campos de más: 400 INVALID_PAYLOAD', async () => {
    const cookie = await e.entrar('recepcion2');
    assert.equal((await recibir(cookie, { base_contada: -1 })).statusCode, 400);
    assert.equal((await recibir(cookie, { base_contada: 184500, responsable: 'otra' })).statusCode, 400);
  });

  it('sin turno ABIERTO no se puede cobrar: SIN_TURNO_ABIERTO (409)', async () => {
    await assert.rejects(turnoAbiertoId(e.bd), (err: ErrorApi) => err.estado === 409 && err.codigo === 'SIN_TURNO_ABIERTO');
    await recibir(await e.entrar('recepcion2'), { base_contada: 184500 });
    assert.equal(await turnoAbiertoId(e.bd), turnoId);
  });
});
