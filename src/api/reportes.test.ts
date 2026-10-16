// TICKET-13 · FR-16 / RN-15. Todos los registros son sintéticos.
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
let usuarioId: string;
let estadiaId: string;
beforeEach(async () => {
  e = await crearEntorno();
  cookie = await e.entrar('admin');
  [{ id: usuarioId }] = await e.bd.consultar<{ id: string }>("SELECT id FROM usuarios WHERE usuario = 'recepcion1'");
  [{ id: estadiaId }] = await e.bd.consultar<{ id: string }>("SELECT id FROM estadias WHERE habitacion_numero = '211'");
});
afterEach(async () => e.cerrar());
const get = (ruta: string, c: string | null = cookie) => e.app.inject({ method: 'GET', url: '/api/v1' + ruta, headers: c ? { cookie: c } : {} });
const reporte = (desde = '2026-10-12', hasta = desde) => get(`/reportes/dias?desde=${desde}&hasta=${hasta}`);

async function turno(inicio = '2026-10-12T06:30:00-05:00', tipo = 'DIA', diferencia = 0) {
  const [t] = await e.bd.consultar<{ id: string }>(`INSERT INTO turnos
    (tipo, estado, responsable_id, inicio_en, fin_en, base_entregada, base_recibida, pago_turno,
     pago_tomado, efectivo_esperado, efectivo_contado, motivo_diferencia)
    VALUES ($1, 'CERRADO', $2, $3, $3::timestamptz + interval '12 hours', 100000, 100000, 70000,
            true, 100000, 100000 + $4, 'Diferencia de prueba') RETURNING id`, [tipo, usuarioId, inicio, diferencia]);
  return t.id;
}
async function pago(turnoId: string, valor: number, estado = 'EN_CAJA') {
  const [p] = await e.bd.consultar<{ id: string }>(`INSERT INTO pagos
    (estadia_id, turno_id, medio, valor, estado, registrado_por, registrado_en, verificado_por, verificado_en)
    VALUES ($1, $2, $3, $4, $5, $6, '2026-10-13T00:15:00-05:00', $7, $8) RETURNING id`,
  [estadiaId, turnoId, estado === 'EN_CAJA' ? 'EFECTIVO' : 'NEQUI', valor, estado, usuarioId,
    ['VERIFICADO', 'RECHAZADO'].includes(estado) ? usuarioId : null,
    ['VERIFICADO', 'RECHAZADO'].includes(estado) ? '2026-10-13T01:00:00-05:00' : null]);
  return p.id;
}

describe('FR-16 / RN-15 — historial y reporte del día del hotel', () => {
  it('solo administración: 401 sin sesión y 403 para recepción en las tres consultas', async () => {
    const recepcion = await e.entrar('recepcion1');
    for (const ruta of ['/turnos', `/turnos/${e.semilla.turnoId}`, '/reportes/dias?desde=2026-10-12&hasta=2026-10-12']) {
      assert.equal((await get(ruta, null)).statusCode, 401);
      assert.equal((await get(ruta, recepcion)).statusCode, 403);
      assert.equal((await get(ruta)).statusCode, 200);
    }
  });

  it('historial del más reciente al más antiguo, paginado y con total independiente de la página', async () => {
    const dia = await turno();
    const r = await get('/turnos?limite=1&desplazamiento=0');
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().total, 2);
    assert.deepEqual(r.json().items.map((t: { id: string }) => t.id), [e.semilla.turnoId]);
    const segunda = (await get('/turnos?limite=1&desplazamiento=1')).json();
    assert.equal(segunda.items[0].id, dia);
    assert.equal(segunda.items[0].cierre.efectivo_contado, 100000);
    assert.deepEqual((await get('/turnos?desplazamiento=100')).json(), { items: [], total: 2 });
  });

  it('límite predeterminado de 20 y orden estable cuando coinciden las horas', async () => {
    for (let i = 0; i < 21; i++) await turno();
    const r = (await get('/turnos')).json();
    assert.equal(r.total, 22);
    assert.equal(r.items.length, 20);
    const restantes = (await get('/turnos?desplazamiento=20')).json().items;
    assert.equal(new Set([...r.items, ...restantes].map((t: { id: string }) => t.id)).size, 22);
  });

  it('detalle incluye pagos y salidas anulados; los totales los excluyen y el cierre permanece intacto', async () => {
    const id = await turno();
    const p = await pago(id, 9000);
    await pago(id, 11000);
    await e.bd.consultar(`UPDATE pagos SET anulado_en = now(), anulado_por = $2, motivo_anulacion = 'Prueba de anulación' WHERE id = $1`, [p, usuarioId]);
    await e.bd.consultar(`INSERT INTO movimientos_caja (turno_id, tipo, detalle, valor, registrado_por, anulado_en, anulado_por, motivo_anulacion)
      VALUES ($1, 'OTRO', 'Salida de prueba', 3000, $2, now(), $2, 'Prueba de anulación'),
             ($1, 'OTRO', 'Salida vigente', 2000, $2, null, null, null)`, [id, usuarioId]);
    const r = await get(`/turnos/${id}`);
    assert.equal(r.statusCode, 200);
    const t = r.json();
    assert.equal(t.pagos.length, 2);
    assert.equal(t.movimientos_caja.length, 2);
    assert.equal(t.pagos.find((x: { id: string }) => x.id === p).anulado, true);
    assert.deepEqual([t.caja.efectivo, t.caja.salidas, t.caja.debe_haber], [11000, 2000, 109000]);
    assert.deepEqual([t.cierre.efectivo_esperado, t.cierre.efectivo_contado, t.cierre.diferencia], [100000, 100000, 0]);
    assert.equal(t.responsable, 'recepcion1');
    assert.equal(t.caja.pago_turno, 70000);
    assert.equal(t.inicio_en, '2026-10-12T06:30:00-05:00');
    assert.equal(t.movimientos_caja.filter((m: { anulado: boolean }) => m.anulado).length, 1);
  });

  it('valida UUID, paginación y fechas; un turno inexistente responde 404', async () => {
    assert.equal((await get('/turnos/00000000-0000-4000-8000-000000000000')).statusCode, 404);
    for (const ruta of ['/turnos/no-es-uuid', '/turnos?limite=0', '/turnos?limite=101', '/turnos?limite=1.5', '/turnos?desplazamiento=-1',
      '/turnos?extra=1', '/reportes/dias', '/reportes/dias?desde=2026-02-30&hasta=2026-03-01',
      '/reportes/dias?desde=2026-10-13&hasta=2026-10-12', '/reportes/dias?desde=ayer&hasta=hoy']) {
      assert.equal((await get(ruta)).statusCode, 400, ruta);
    }
  });

  it('Resumen del día 12 de octubre: 195.000 + 26.000 = 221.000, sin sumar la base', async () => {
    const dia = await turno();
    await pago(dia, 195000);
    const r = await reporte();
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json().items, [{
      dia: '2026-10-12', desde: '2026-10-12T06:30:00-05:00', hasta: '2026-10-13T06:30:00-05:00',
      turnos: [{ tipo: 'DIA', responsable: 'recepcion1' }, { tipo: 'NOCHE', responsable: 'recepcion2' }],
      efectivo: 221000, transferencias_verificadas: 55000, transferencias_pendientes: 30000,
      descuentos: 0, salidas: 0, diferencias: 0,
    }]);
  });

  it('corte inclusivo a las 6:30, exclusivo al día siguiente, con madrugada y cambio de mes en Bogotá', async () => {
    await turno('2026-11-01T11:29:59Z', 'NOCHE');
    await turno('2026-11-01T11:30:00Z', 'DIA');
    const r = await reporte('2026-10-31', '2026-11-01');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json().items.map((d: { dia: string; turnos: unknown[] }) => [d.dia, d.turnos.length]),
      [['2026-10-31', 1], ['2026-11-01', 1]]);
    assert.equal(r.json().items[0].hasta, '2026-11-01T06:30:00-05:00');
    assert.deepEqual((await reporte('2026-11-02')).json(), { items: [] });
  });

  it('suma por separado descuentos, salidas y diferencias; omite anulados y transferencias rechazadas', async () => {
    const dia = await turno(undefined, undefined, -4500);
    await pago(dia, 15000, 'RECHAZADO');
    const p = await pago(dia, 12000, 'VERIFICADO');
    await e.bd.consultar(`UPDATE pagos SET anulado_en = now(), anulado_por = $2, motivo_anulacion = 'Prueba anulada' WHERE id = $1`, [p, usuarioId]);
    await e.bd.consultar(`INSERT INTO movimientos_caja (turno_id, tipo, detalle, valor, registrado_por, anulado_en, anulado_por, motivo_anulacion)
      VALUES ($1, 'OTRO', 'Salida vigente', 2000, $2, null, null, null),
             ($1, 'OTRO', 'Salida anulada', 8000, $2, now(), $2, 'Prueba anulada')`, [dia, usuarioId]);
    await e.bd.consultar(`INSERT INTO cargos (estadia_id, tipo, concepto, valor_unitario, valor, creado_por, creado_en, anulado_en, anulado_por, motivo_anulacion)
      VALUES ($1, 'DESCUENTO', 'Descuento de prueba', -5000, -5000, $2, '2026-10-12T20:00:00-05:00', null, null, null),
             ($1, 'DESCUENTO', 'Descuento anulado', -5000, -5000, $2, '2026-10-12T20:01:00-05:00', now(), $2, 'Prueba anulada')`, [estadiaId, usuarioId]);
    const r = await reporte();
    assert.equal(r.statusCode, 200);
    const d = r.json().items[0];
    assert.deepEqual([d.efectivo, d.transferencias_verificadas, d.transferencias_pendientes, d.descuentos, d.salidas, d.diferencias],
      [26000, 55000, 30000, 5000, 2000, -4500]);
  });

  it('la verificación posterior actualiza el día del cobro, sin moverlo al día de confirmación', async () => {
    const r = await e.app.inject({ method: 'POST', url: `/api/v1/pagos/${e.semilla.pagoPorVerificarId}/verificacion`,
      headers: { cookie }, payload: { resultado: 'LLEGO' } });
    assert.equal(r.statusCode, 200);
    const d = (await reporte()).json().items[0];
    assert.deepEqual([d.transferencias_verificadas, d.transferencias_pendientes], [85000, 0]);
  });

  it('turno por recibir aparece en el historial sin responsable ni cierre y no infla el resumen', async () => {
    const recepcion = await e.entrar('recepcion2');
    const r = await e.app.inject({ method: 'POST', url: '/api/v1/turnos/actual/entrega', headers: { cookie: recepcion },
      payload: { pago_tomado: true, efectivo_contado: 184500 } });
    assert.equal(r.statusCode, 200);
    const t = (await get('/turnos')).json().items[0];
    assert.deepEqual([t.estado, t.responsable, t.cierre], ['POR_RECIBIR', null, null]);
    assert.equal((await reporte()).json().items[0].turnos.length, 1);
  });
});
