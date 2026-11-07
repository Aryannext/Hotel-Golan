// HG-HAL-001 HAL-18 [P/V] · un turno trabado (quien lo tenía se fue sin entregarlo) ya no necesita SQL a mano: la
// administración cuenta la plata y lo cierra con el motivo, que queda en la auditoría. Su sesión sigue abierta.
// En la semilla, el turno de noche ABIERTO es de recepcion2: «debe haber» 234.500 y pago del turno 50.000.
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let admin: string;
beforeEach(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T07:30:00-05:00');
  admin = await e.entrar('admin');
});
afterEach(async () => e.cerrar());

const entregar = (payload: Record<string, unknown>, cookie = admin) =>
  e.app.inject({ method: 'POST', url: '/api/v1/turnos/actual/entrega', payload, headers: { cookie } });

describe('HAL-18 — la administración cierra un turno que no se entregó', () => {
  it('sin el motivo del cierre sigue la regla de FR-13 (la administración no entrega turnos): 403, con el camino en palabras', async () => {
    const r = await entregar({ pago_tomado: true, efectivo_contado: 184500 });
    assert.deepEqual([r.statusCode, r.json().codigo], [403, 'SIN_PERMISO']);
    assert.match(r.json().mensaje, /ciérrelo escribiendo el motivo/);
  });

  it('con el motivo: el turno queda CERRADO por la administración, el siguiente por recibir y la sesión de ella sigue', async () => {
    const r = await entregar({ pago_tomado: true, efectivo_contado: 184500, motivo_cierre: 'Se fue sin entregar; conté la caja con la del día' });
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().estado, r.json().responsable, r.json().cierre.entregado_por, r.json().cierre.diferencia], ['CERRADO', 'recepcion2', 'admin', 0]);
    assert.equal(r.headers['set-cookie'], undefined);
    const siguiente = (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie: admin } }));
    assert.equal(siguiente.statusCode, 200, siguiente.body);
    assert.deepEqual([siguiente.json().estado, siguiente.json().base_entregada], ['POR_RECIBIR', 184500]);
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'ENTREGAR_TURNO' ORDER BY ocurrido_en DESC LIMIT 1`);
    assert.equal(a.detalle.cierre_por_administracion, 'Se fue sin entregar; conté la caja con la del día');
  });

  it('otra persona de recepción sigue sin poder entregar un turno ajeno: 403', async () => {
    const otra = await e.entrar('recepcion1');
    const r = await entregar({ pago_tomado: true, efectivo_contado: 184500, motivo_cierre: 'No es mío pero lo cierro' }, otra);
    assert.equal(r.statusCode, 403);
  });
});
