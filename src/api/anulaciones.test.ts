// TICKET-12 · POST /pagos/{id}/anulacion y POST /movimientos_caja/{id}/anulacion (FR-17, FR-20) según docs/CONTRATO_API.yaml.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
let admin: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T05:40:00-05:00');
  recepcion = await e.entrar('recepcion2');
  admin = await e.entrar('admin');
});
after(async () => e.cerrar());

const anularPago = (id: string, motivo: string, c = admin) =>
  e.app.inject({ method: 'POST', url: `/api/v1/pagos/${id}/anulacion`, payload: { motivo }, headers: { cookie: c } });
const anularMovimiento = (id: string, motivo: string, c = admin) =>
  e.app.inject({ method: 'POST', url: `/api/v1/movimientos_caja/${id}/anulacion`, payload: { motivo }, headers: { cookie: c } });
const caja = async () => (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie: recepcion } })).json().caja;
const cuenta211 = async () => {
  const [s] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '211' AND estado = 'ACTIVA'`);
  return (await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${s.id}`, headers: { cookie: recepcion } })).json().cuenta;
};
const auditoria = async (entidad: string, id: string) => (await e.bd.consultar<{ usuario: string }>(
  `SELECT u.usuario FROM auditoria a JOIN usuarios u ON u.id = a.usuario_id WHERE a.accion = 'ANULAR' AND a.entidad = $1 AND a.entidad_id = $2`, [entidad, id])).map((x) => x.usuario);

describe('FR-17, FR-20 — Anulaciones de la administración', () => {
  it('anular un cobro en efectivo: sigue visible como anulado, deja de sumar a la caja y la cuenta vuelve a deber', async () => {
    const [p] = await e.bd.consultar<{ id: string }>(`SELECT id FROM pagos WHERE medio = 'EFECTIVO' AND valor = 4000`);
    const cajaAntes = await caja();
    const cuentaAntes = await cuenta211();
    const r = await anularPago(p.id, 'Cobro registrado dos veces');
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().id, r.json().anulado, r.json().valor, r.json().habitacion_numero], [p.id, true, 4000, '211']);
    assert.equal((await caja()).debe_haber, cajaAntes.debe_haber - 4000);
    assert.equal((await cuenta211()).saldo, cuentaAntes.saldo + 4000);
    const [f] = await e.bd.consultar<{ motivo_anulacion: string; anulado_en: Date }>('SELECT motivo_anulacion, anulado_en FROM pagos WHERE id = $1', [p.id]);
    assert.equal(f.motivo_anulacion, 'Cobro registrado dos veces');
    assert.equal(new Date(f.anulado_en).toISOString(), new Date('2026-10-13T05:40:00-05:00').toISOString());
    assert.deepEqual(await auditoria('pagos', p.id), ['admin']);
    const lista = (await e.app.inject({ method: 'GET', url: `/api/v1/pagos?turno_id=${e.semilla.turnoId}`, headers: { cookie: recepcion } })).json().items;
    assert.ok(lista.some((x: { id: string; anulado: boolean }) => x.id === p.id && x.anulado));
  });

  it('anular una transferencia por verificar la quita de «por confirmar»', async () => {
    const r = await anularPago(e.semilla.pagoPorVerificarId, 'El cliente no hizo la transferencia');
    assert.equal(r.statusCode, 200);
    const items = (await e.app.inject({ method: 'GET', url: '/api/v1/pagos?estado=POR_VERIFICAR', headers: { cookie: admin } })).json().items;
    assert.equal(items.length, 0);
    assert.equal((await caja()).por_verificar_cantidad, 0);
  });

  it('anular una salida de dinero: el «debe haber» vuelve a subir y queda auditado', async () => {
    const m = await e.app.inject({ method: 'POST', url: '/api/v1/movimientos_caja', payload: { tipo: 'COMPRA_HOTEL', detalle: '2 jabones', valor: 10000 }, headers: { cookie: recepcion } });
    const antes = await caja();
    const r = await anularMovimiento(m.json().id, 'Los jabones los pagó la administradora');
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().anulado, r.json().tipo, r.json().valor], [true, 'COMPRA_HOTEL', 10000]);
    assert.equal((await caja()).debe_haber, antes.debe_haber + 10000);
    assert.deepEqual(await auditoria('movimientos_caja', m.json().id), ['admin']);
  });

  it('recepción no anula: 403 SIN_PERMISO', async () => {
    const [p] = await e.bd.consultar<{ id: string }>(`SELECT id FROM pagos WHERE medio = 'EFECTIVO' AND valor = 22000`);
    const r = await anularPago(p.id, 'Me equivoqué de valor', recepcion);
    assert.equal(r.statusCode, 403);
    assert.equal(r.json().codigo, 'SIN_PERMISO');
  });

  it('motivo corto: 400; lo ya anulado: 409; lo que no existe: 404', async () => {
    const [p] = await e.bd.consultar<{ id: string }>(`SELECT id FROM pagos WHERE medio = 'EFECTIVO' AND valor = 22000`);
    assert.equal((await anularPago(p.id, 'mal')).statusCode, 400);
    const [ya] = await e.bd.consultar<{ id: string }>(`SELECT id FROM pagos WHERE anulado_en IS NOT NULL LIMIT 1`);
    assert.equal((await anularPago(ya.id, 'Otra vez el mismo')).json().codigo, 'CONFLICTO');
    assert.equal((await anularPago('00000000-0000-4000-8000-000000000000', 'No existe este')).statusCode, 404);
    assert.equal((await anularMovimiento('00000000-0000-4000-8000-000000000000', 'No existe este')).statusCode, 404);
  });

  it('la salida de una devolución no se anula por aquí: 409', async () => {
    const r = await e.app.inject({
      method: 'POST', url: '/api/v1/estadias', headers: { cookie: recepcion },
      payload: {
        habitacion_numero: '206', modalidad: 'NOCHE', personas: 1, huesped: { nombre: 'Huésped Prueba 90', nacionalidad: 'Colombia', es_menor: false },
        autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 45000 },
      },
    });
    const d = await e.app.inject({ method: 'POST', url: `/api/v1/estadias/${r.json().id}/devoluciones`, payload: { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' }, headers: { cookie: recepcion } });
    const m = await anularMovimiento(d.json().movimiento_caja_id, 'La devolución fue un error');
    assert.equal(m.statusCode, 409);
    assert.equal(m.json().codigo, 'CONFLICTO');
  });
});
