// TICKET-05 · GET /pagos y POST /pagos/{id}/verificacion (FR-07, FR-15; RN-12) según docs/CONTRATO_API.yaml.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
let admin: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:20:00-05:00');
  recepcion = await e.entrar('recepcion2');
  admin = await e.entrar('admin');
});
after(async () => e.cerrar());

const listar = (q = '', c = recepcion) => e.app.inject({ method: 'GET', url: `/api/v1/pagos${q}`, headers: { cookie: c } });
const verificar = (id: string, resultado: string, c = admin, clave?: string) => e.app.inject({
  method: 'POST', url: `/api/v1/pagos/${id}/verificacion`, payload: { resultado },
  headers: { cookie: c, ...(clave ? { 'idempotency-key': clave } : {}) },
});
const cuentaDe = async (hab: string) => {
  const [s] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = $1 AND estado = 'ACTIVA'`, [hab]);
  return (await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${s.id}`, headers: { cookie: recepcion } })).json().cuenta;
};
/** Registra una entrada sintética pagada por Nequi y devuelve el id del pago POR_VERIFICAR. */
async function entradaPorNequi(hab: string): Promise<string> {
  const r = await e.app.inject({
    method: 'POST', url: '/api/v1/estadias', headers: { cookie: recepcion },
    payload: {
      habitacion_numero: hab, modalidad: 'NOCHE', personas: 1,
      huesped: { nombre: `Huésped Prueba ${hab}`, tipo_documento: 'CC', numero_documento: 'PRUEBA0099', nacionalidad: 'Colombia', es_menor: false },
      autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'NEQUI' },
    },
  });
  assert.equal(r.statusCode, 201, r.body);
  return r.json().pagos[0].id;
}

describe('RN-12, FR-15 — Pagos por confirmar', () => {
  it('sin sesión: 401', async () => {
    assert.equal((await e.app.inject({ method: 'GET', url: '/api/v1/pagos' })).statusCode, 401);
  });

  it('GET /pagos?estado=POR_VERIFICAR muestra la transferencia de la 211 con el contrato Pago', async () => {
    const r = await listar('?estado=POR_VERIFICAR', admin);
    assert.equal(r.statusCode, 200);
    const items = r.json().items;
    assert.equal(items.length, 1);
    assert.deepEqual(items[0], {
      id: e.semilla.pagoPorVerificarId, estadia_id: items[0].estadia_id, habitacion_numero: '211', venta_id: null, venta_detalle: null, pedido_lavanderia_id: null, lavanderia_cliente: null, turno_id: e.semilla.turnoId,
      medio: 'BANCOLOMBIA', valor: 30000, estado: 'POR_VERIFICAR', registrado_por: 'recepcion2', registrado_en: '2026-10-12T20:12:00-05:00',
      verificado_por: null, verificado_en: null, anulado: false,
    });
  });

  it('GET /pagos filtra por turno y recepción también puede consultar', async () => {
    const r = await listar(`?turno_id=${e.semilla.turnoId}`);
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().items.length, 4);
    assert.equal((await listar('?estado=OTRO')).statusCode, 400);
  });

  it('la administradora confirma con un toque: VERIFICADO con verificado_por «admin»; la caja no cambia', async () => {
    const pagoId = await entradaPorNequi('209');
    const cajaAntes = (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie: recepcion } })).json().caja;
    const r = await verificar(pagoId, 'LLEGO');
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().id, r.json().estado, r.json().verificado_por, r.json().verificado_en, r.json().habitacion_numero],
      [pagoId, 'VERIFICADO', 'admin', '2026-10-13T06:20:00-05:00', '209']);
    assert.deepEqual(await cuentaDe('209'), { total_cargos: 45000, pagado: 45000, por_verificar: 0, saldo: 0, a_favor: 0, devuelto: 0 });
    const caja = (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie: recepcion } })).json().caja;
    assert.equal(caja.debe_haber, cajaAntes.debe_haber);
    assert.equal(caja.transferencias, cajaAntes.transferencias);
    assert.equal(caja.por_verificar_cantidad, cajaAntes.por_verificar_cantidad - 1);
    const aud = await e.bd.consultar<{ n: number }>(
      `SELECT count(*)::int AS n FROM auditoria WHERE accion = 'VERIFICAR' AND entidad = 'pagos' AND entidad_id = $1`, [pagoId]);
    assert.equal(aud[0].n, 1);
  });

  it('la transferencia no llegó: RECHAZADO y el saldo de la 211 sube 30.000', async () => {
    const antes = await cuentaDe('211');
    const r = await verificar(e.semilla.pagoPorVerificarId, 'NO_LLEGO');
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().estado, 'RECHAZADO');
    const despues = await cuentaDe('211');
    assert.equal(despues.saldo, antes.saldo + 30000);
    assert.equal(despues.por_verificar, 0);
  });

  it('recepción no puede confirmar transferencias: 403 SIN_PERMISO', async () => {
    const pagoId = await entradaPorNequi('210');
    const r = await verificar(pagoId, 'LLEGO', recepcion);
    assert.equal(r.statusCode, 403);
    assert.equal(r.json().codigo, 'SIN_PERMISO');
  });

  it('un pago ya confirmado o en efectivo: 409; uno que no existe: 404; resultado inválido: 400', async () => {
    const [ya] = await e.bd.consultar<{ id: string }>(`SELECT id FROM pagos WHERE estado = 'VERIFICADO' LIMIT 1`);
    assert.equal((await verificar(ya.id, 'LLEGO')).statusCode, 409);
    const [efectivo] = await e.bd.consultar<{ id: string }>(`SELECT id FROM pagos WHERE medio = 'EFECTIVO' LIMIT 1`);
    assert.equal((await verificar(efectivo.id, 'LLEGO')).json().codigo, 'CONFLICTO');
    assert.equal((await verificar('00000000-0000-4000-8000-000000000000', 'LLEGO')).statusCode, 404);
    assert.equal((await verificar(ya.id, 'TAL_VEZ')).statusCode, 400);
  });

  it('con Idempotency-Key, un doble toque devuelve lo mismo y no se aplica dos veces', async () => {
    const pagoId = await entradaPorNequi('208');
    const clave = '3d1f0b2a-6c4e-4a8b-9f10-1b2c3d4e5f60';
    const a = await verificar(pagoId, 'LLEGO', admin, clave);
    const b = await verificar(pagoId, 'LLEGO', admin, clave);
    assert.deepEqual([a.statusCode, b.statusCode], [200, 200]);
    assert.equal(b.json().estado, 'VERIFICADO');
    const ev = await e.bd.consultar<{ n: number }>(
      `SELECT count(*)::int AS n FROM eventos_salida WHERE tipo = 'pago.verificado' AND payload->>'entidad_id' = $1`, [pagoId]);
    assert.equal(ev[0].n, 1);
  });
});
