// TICKET-09 · POST /estadias/{id}/devoluciones (FR-10; RN-08) según docs/CONTRATO_API.yaml.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
let admin: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T05:00:00-05:00');
  cookie = await e.entrar('recepcion2');
  admin = await e.entrar('admin');
});
after(async () => e.cerrar());

/** Entrada sintética; devuelve la estadía creada. */
async function entrada(hab: string, personas: number, pago: Record<string, unknown>) {
  const r = await e.app.inject({
    method: 'POST', url: '/api/v1/estadias', headers: { cookie },
    payload: {
      habitacion_numero: hab, modalidad: 'NOCHE', personas, huesped: { nombre: `Huésped Prueba ${hab}`, tipo_documento: 'CC', numero_documento: 'PRUEBA0099', nacionalidad: 'Colombia', es_menor: false },
      autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago,
    },
  });
  assert.equal(r.statusCode, 201, r.body);
  return r.json() as { id: string; pagos: Array<{ id: string }> };
}
const desistir = (id: string, payload: Record<string, unknown>, c = cookie, clave?: string) => e.app.inject({
  method: 'POST', url: `/api/v1/estadias/${id}/devoluciones`, payload, headers: { cookie: c, ...(clave ? { 'idempotency-key': clave } : {}) },
});
const caja = async () => (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie } })).json().caja;
const estado = async (id: string) => (await e.bd.consultar<{ estado: string; salida_real_en: Date | null; hab: string }>(
  `SELECT e.estado, e.salida_real_en, h.estado AS hab FROM estadias e JOIN habitaciones h ON h.numero = e.habitacion_numero WHERE e.id = $1`, [id]))[0];

describe('RN-08, FR-10 — Devolución por desistimiento', () => {
  it('solo miró la habitación y pagó en efectivo: se devuelven 45.000 con un movimiento DEVOLUCION en el turno abierto', async () => {
    const cajaAntes = await caja();
    const est = await entrada('206', 1, { forma: 'EFECTIVO', valor_recibido: 45000 });
    const r = await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' });
    assert.equal(r.statusCode, 201);
    const d = r.json();
    assert.deepEqual([d.estadia_id, d.motivo, d.valor, d.medio, d.registrada_por, d.registrada_en],
      [est.id, 'SOLO_MIRO', 45000, 'EFECTIVO', 'recepcion2', '2026-10-13T05:00:00-05:00']);
    const [m] = await e.bd.consultar<{ tipo: string; valor: number; turno_id: string; habitacion_numero: string }>(
      'SELECT tipo, valor, turno_id, habitacion_numero FROM movimientos_caja WHERE id = $1', [d.movimiento_caja_id]);
    assert.deepEqual(m, { tipo: 'DEVOLUCION', valor: 45000, turno_id: e.semilla.turnoId, habitacion_numero: '206' });
    const s = await estado(est.id);
    assert.deepEqual([s.estado, s.hab, !!s.salida_real_en], ['DESISTIDA', 'POR_REVISAR', true]);
    // Entró y salió el mismo dinero: la caja queda como antes.
    assert.equal((await caja()).debe_haber, cajaAntes.debe_haber);
    const [a] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM auditoria WHERE accion = 'CREAR' AND entidad = 'devoluciones' AND entidad_id = $1`, [d.id]);
    assert.equal(a.n, 1);
  });

  it('ya usó la habitación: la devolución es de 0 y no se crea movimiento de caja', async () => {
    const est = await entrada('208', 2, { forma: 'EFECTIVO', valor_recibido: 55000 });
    const r = await desistir(est.id, { motivo: 'YA_USO', medio: 'EFECTIVO' });
    assert.equal(r.statusCode, 201);
    assert.deepEqual([r.json().valor, r.json().movimiento_caja_id], [0, null]);
    assert.equal((await estado(est.id)).estado, 'DESISTIDA');
  });

  it('transferencia sin verificar: 409 PAGO_SIN_VERIFICAR y la estadía sigue activa', async () => {
    const est = await entrada('209', 2, { forma: 'NEQUI' });
    const r = await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().codigo, 'PAGO_SIN_VERIFICAR');
    assert.equal((await estado(est.id)).estado, 'ACTIVA');
  });

  it('si pagó por transferencia (ya confirmada), el medio lo decide la administración', async () => {
    const est = await entrada('210', 1, { forma: 'BANCOLOMBIA' });
    await e.app.inject({ method: 'POST', url: `/api/v1/pagos/${est.pagos[0].id}/verificacion`, payload: { resultado: 'LLEGO' }, headers: { cookie: admin } });
    const r = await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' });
    assert.equal(r.statusCode, 403);
    assert.equal(r.json().codigo, 'SIN_PERMISO');
    const a = await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'TRANSFERENCIA' }, admin);
    assert.equal(a.statusCode, 201);
    assert.deepEqual([a.json().valor, a.json().medio, a.json().movimiento_caja_id, a.json().registrada_por], [45000, 'TRANSFERENCIA', null, 'admin']);
  });

  it('recepción no elige devolver por transferencia: 403', async () => {
    const est = await entrada('201', 1, { forma: 'EFECTIVO', valor_recibido: 60000 });
    assert.equal((await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'TRANSFERENCIA' })).statusCode, 403);
  });

  it('una sola devolución por estadía (la segunda: 409) y con Idempotency-Key se devuelve la misma', async () => {
    const est = await entrada('202', 1, { forma: 'EFECTIVO', valor_recibido: 60000 });
    const clave = '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b';
    const a = await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' }, cookie, clave);
    const b = await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' }, cookie, clave);
    assert.deepEqual([a.statusCode, b.statusCode, b.json().id], [201, 201, a.json().id]);
    const otra = await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' });
    assert.equal(otra.statusCode, 409);
    const [n] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM movimientos_caja WHERE tipo = 'DEVOLUCION' AND habitacion_numero = '202'`);
    assert.equal(n.n, 1);
  });

  it('si iba a pagar al salir y no pagó nada, solo miró: devolución de 0', async () => {
    const est = await entrada('203', 1, { forma: 'AL_SALIR' });
    const r = await desistir(est.id, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' });
    assert.deepEqual([r.statusCode, r.json().valor, r.json().movimiento_caja_id], [201, 0, null]);
  });

  it('estadía inexistente: 404; motivo o medio inválido: 400', async () => {
    assert.equal((await desistir('00000000-0000-4000-8000-000000000000', { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' })).statusCode, 404);
    const [s] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '211' AND estado = 'ACTIVA'`);
    assert.equal((await desistir(s.id, { motivo: 'NO_LE_GUSTO', medio: 'EFECTIVO' })).statusCode, 400);
    assert.equal((await desistir(s.id, { motivo: 'SOLO_MIRO', medio: 'NEQUI' })).statusCode, 400);
  });
});
