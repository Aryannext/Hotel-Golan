// TICKET-11 · POST /turnos/actual/entrega (FR-13; RN-09, RN-11) según docs/CONTRATO_API.yaml.
// En la semilla, el turno de noche ABIERTO es de recepcion2: «debe haber» 234.500 y pago del turno 50.000.
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
beforeEach(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:25:00-05:00');
  cookie = await e.entrar('recepcion2');
});
afterEach(async () => e.cerrar());

const entregar = (payload: Record<string, unknown>, c: string | null = cookie) =>
  e.app.inject({ method: 'POST', url: '/api/v1/turnos/actual/entrega', payload, headers: c ? { cookie: c } : {} });
const estadoTurno = async (id: string) =>
  (await e.bd.consultar<{ estado: string }>('SELECT estado FROM turnos WHERE id = $1', [id]))[0].estado;

describe('RN-09, RN-11, FR-13 — Entrega del turno', () => {
  it('sin sesión: 401', async () => {
    assert.equal((await entregar({ pago_tomado: true, efectivo_contado: 184500 }, null)).statusCode, 401);
  });

  it('entrega que cuadra: CERRADO con esperado 184.500 y diferencia 0; el turno de día queda por recibir con 184.500', async () => {
    const r = await entregar({ pago_tomado: true, efectivo_contado: 184500 });
    assert.equal(r.statusCode, 200);
    const t = r.json();
    assert.deepEqual([t.id, t.tipo, t.estado, t.responsable, t.fin_en], [e.semilla.turnoId, 'NOCHE', 'CERRADO', 'recepcion2', '2026-10-13T06:25:00-05:00']);
    assert.deepEqual(t.cierre, {
      pago_tomado: true, efectivo_esperado: 184500, efectivo_contado: 184500, diferencia: 0, motivo_diferencia: null, entregado_por: 'recepcion2',
      // TICKET-31: sin nada registrado después, lo ajustado es igual al cierre.
      efectivo_esperado_ajustado: 184500, diferencia_ajustada: 0,
      // HAL-18: lo entregó su responsable, no la administración.
      motivo_cierre: null,
    });
    const otra = await e.entrar('recepcion1');
    const siguiente = (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie: otra } })).json();
    assert.deepEqual([siguiente.tipo, siguiente.estado, siguiente.base_entregada, siguiente.recibido_de, siguiente.responsable, siguiente.caja.pago_turno],
      ['DIA', 'POR_RECIBIR', 184500, 'recepcion2', null, 70000]);
    assert.equal((await e.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual', headers: { cookie: otra } })).json().turno_por_recibir, true);
    const [a] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM auditoria WHERE accion = 'ENTREGAR_TURNO' AND entidad_id = $1`, [e.semilla.turnoId]);
    assert.equal(a.n, 1);
    const [ev] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM eventos_salida WHERE tipo = 'turno.entregado'`);
    assert.equal(ev.n, 1);
  });

  it('al entregar se cierra la sesión de quien entregó', async () => {
    const r = await entregar({ pago_tomado: true, efectivo_contado: 184500 });
    assert.equal(r.statusCode, 200);
    const c = r.cookies.find((x) => x.name === 'sesion');
    assert.ok(c && c.value === '', 'la cookie de sesión se borra');
    assert.equal((await e.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual', headers: { cookie } })).statusCode, 401);
  });

  it('entrega que no cuadra exige motivo (422 MOTIVO_REQUERIDO); con motivo queda la diferencia de −4.500 y se avisa', async () => {
    const sin = await entregar({ pago_tomado: true, efectivo_contado: 180000 });
    assert.equal(sin.statusCode, 422);
    assert.equal(sin.json().codigo, 'MOTIVO_REQUERIDO');
    assert.equal(await estadoTurno(e.semilla.turnoId), 'ABIERTO');
    const r = await entregar({ pago_tomado: true, efectivo_contado: 180000, motivo_diferencia: 'devolví 4.500 de vueltas a la 205' });
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().estado, r.json().cierre.diferencia, r.json().cierre.motivo_diferencia], ['CERRADO', -4500, 'devolví 4.500 de vueltas a la 205']);
    const ev = await e.bd.consultar<{ payload: Record<string, unknown> }>(`SELECT payload FROM eventos_salida WHERE tipo = 'turno.diferencia'`);
    assert.deepEqual(ev.map((x) => x.payload.diferencia), [-4500]);
  });

  it('si no tomó su pago, lo esperado es todo el «debe haber» (234.500)', async () => {
    const r = await entregar({ pago_tomado: false, efectivo_contado: 234500 });
    assert.deepEqual([r.statusCode, r.json().cierre.efectivo_esperado, r.json().cierre.diferencia], [200, 234500, 0]);
  });

  it('la administración no entrega turnos: 403 SIN_PERMISO', async () => {
    const r = await entregar({ pago_tomado: true, efectivo_contado: 184500 }, await e.entrar('admin'));
    assert.equal(r.statusCode, 403);
    assert.equal(r.json().codigo, 'SIN_PERMISO');
  });

  it('solo lo entrega quien tiene el turno: otra recepcionista recibe 403', async () => {
    const r = await entregar({ pago_tomado: true, efectivo_contado: 184500 }, await e.entrar('recepcion1'));
    assert.equal(r.statusCode, 403);
    assert.equal(await estadoTurno(e.semilla.turnoId), 'ABIERTO');
  });

  it('sin turno abierto no hay nada que entregar: 409 SIN_TURNO_ABIERTO; datos inválidos: 400', async () => {
    assert.equal((await entregar({ pago_tomado: true })).statusCode, 400);
    assert.equal((await entregar({ pago_tomado: true, efectivo_contado: -1 })).statusCode, 400);
    await entregar({ pago_tomado: true, efectivo_contado: 184500 });
    const r = await entregar({ pago_tomado: true, efectivo_contado: 184500 }, await e.entrar('recepcion1'));
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().codigo, 'SIN_TURNO_ABIERTO');
  });

  it('ciclo completo: entrega la noche y la siguiente recibe el día con lo contado', async () => {
    await entregar({ pago_tomado: true, efectivo_contado: 184500 });
    e.fijarHora('2026-10-13T06:31:00-05:00');
    const otra = await e.entrar('recepcion1');
    const r = await e.app.inject({ method: 'POST', url: '/api/v1/turnos/actual/recepcion', payload: { base_contada: 184500 }, headers: { cookie: otra } });
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().tipo, r.json().estado, r.json().responsable, r.json().recibido_de, r.json().caja.debe_haber, r.json().fin_programado_en],
      ['DIA', 'ABIERTO', 'recepcion1', 'recepcion2', 184500, '2026-10-13T18:30:00-05:00']);
  });
});
