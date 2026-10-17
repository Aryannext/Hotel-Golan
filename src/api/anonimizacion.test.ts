// TICKET-17 · anonimizar los datos de huéspedes a los `retencion_datos_dias` (90) de la salida (FR-21, RN-16, ADR-006).
// Los 90 días son una interpretación [P/V] que confirma la administradora; el valor es configurable.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';
import { anonimizarVencidos, programarAnonimizacion } from './privacidad/anonimizacion.ts';

let e: Entorno;
let recepcion: string;
let ana: { estadia: string; huesped: string };
let reciente: { estadia: string; huesped: string };
let desistio: { estadia: string; huesped: string };

const entrada = async (habitacion: string, huesped: Record<string, unknown>) => {
  const r = await e.app.inject({
    method: 'POST', url: '/api/v1/estadias', headers: { cookie: recepcion },
    payload: { habitacion_numero: habitacion, modalidad: 'NOCHE', personas: 1, huesped: { nacionalidad: 'Colombia', es_menor: false, ...huesped },
      autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 60000 } },
  });
  assert.equal(r.statusCode, 201, r.body);
  const [f] = await e.bd.consultar<{ huesped_id: string }>('SELECT huesped_id FROM estadias WHERE id = $1', [r.json().id]);
  return { estadia: r.json().id as string, huesped: f.huesped_id };
};
/** Mueve las fechas de una estadía ya terminada (dato de prueba): así se simula una salida antigua. */
const fecharSalida = (estadia: string, salida: string) => e.bd.consultar(
  `UPDATE estadias SET entrada_en = $2::timestamptz - interval '20 hours', salida_prevista_en = $2::timestamptz + interval '1 hour', salida_real_en = $2 WHERE id = $1`,
  [estadia, salida]);
const huesped = async (id: string) => (await e.bd.consultar<Record<string, unknown>>(
  'SELECT nombre, tipo_documento, numero_documento, telefono, nacionalidad, anonimizado_en FROM huespedes WHERE id = $1', [id]))[0];
const auditorias = () => e.bd.consultar<{ usuario_id: string | null; entidad: string; detalle: Record<string, string> }>(
  `SELECT usuario_id, entidad, detalle FROM auditoria WHERE accion = 'ANONIMIZAR' ORDER BY id`);

before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:10:00-05:00');
  recepcion = await e.entrar('recepcion2');
  ana = await entrada('201', { nombre: 'Ana Prueba Sintética', tipo_documento: 'CC', numero_documento: '12345678', telefono: '+573000000001' });
  assert.equal((await e.app.inject({ method: 'POST', url: `/api/v1/estadias/${ana.estadia}/salida`, headers: { cookie: recepcion } })).statusCode, 200);
  await fecharSalida(ana.estadia, '2026-07-10T11:00:00-05:00');
  reciente = await entrada('202', { nombre: 'Huésped Prueba Reciente', tipo_documento: 'CC', numero_documento: 'PRUEBA0202' });
  assert.equal((await e.app.inject({ method: 'POST', url: `/api/v1/estadias/${reciente.estadia}/salida`, headers: { cookie: recepcion } })).statusCode, 200);
  await fecharSalida(reciente.estadia, '2026-10-02T11:00:00-05:00');
  desistio = await entrada('203', { nombre: 'Huésped Prueba Desistió' });
  const d = await e.app.inject({ method: 'POST', url: `/api/v1/estadias/${desistio.estadia}/devoluciones`, payload: { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' }, headers: { cookie: recepcion } });
  assert.equal(d.statusCode, 201, d.body);
  await fecharSalida(desistio.estadia, '2026-07-01T09:00:00-05:00');
});
after(async () => e.cerrar());

describe('FR-21 — anonimizar a los 90 días', () => {
  it('con una retención mayor no borra nada: el plazo sale de la regla configurable', async () => {
    await e.bd.consultar(`UPDATE reglas SET valor = 200 WHERE clave = 'retencion_datos_dias'`);
    assert.deepEqual(await anonimizarVencidos(e.bd, new Date('2026-10-09T03:00:00-05:00')), { anonimizados: 0 });
    await e.bd.consultar(`UPDATE reglas SET valor = 90 WHERE clave = 'retencion_datos_dias'`);
    assert.equal((await huesped(ana.huesped)).nombre, 'Ana Prueba Sintética');
    assert.equal((await auditorias()).length, 0);
  });

  it('antes de cumplir los 90 días no se borra; la estadía desistida hace más de 90 días sí', async () => {
    assert.deepEqual(await anonimizarVencidos(e.bd, new Date('2026-10-08T10:59:00-05:00')), { anonimizados: 1 });
    assert.equal((await huesped(ana.huesped)).nombre, 'Ana Prueba Sintética');
    assert.equal((await huesped(desistio.huesped)).nombre, null);
  });

  it('Escenario «Anonimizar a los 90 días»: salida el 10-07-2026, tarea el 09-10-2026', async () => {
    const cuentaAntes = (await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${ana.estadia}`, headers: { cookie: recepcion } })).json();
    const momento = new Date('2026-10-09T03:00:00-05:00');
    assert.deepEqual(await anonimizarVencidos(e.bd, momento), { anonimizados: 1 });

    const h = await huesped(ana.huesped);
    assert.deepEqual([h.nombre, h.tipo_documento, h.numero_documento, h.telefono], [null, null, null, null]);
    assert.equal(new Date(h.anonimizado_en as Date).toISOString(), momento.toISOString());
    assert.equal(h.nacionalidad, 'Colombia');

    const despues = (await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${ana.estadia}`, headers: { cookie: recepcion } })).json();
    assert.deepEqual([despues.huesped.nombre_mostrado, despues.huesped.documento_enmascarado, despues.huesped.anonimizado], ['Huésped anonimizado', null, true]);
    assert.deepEqual(despues.cargos, cuentaAntes.cargos);
    assert.deepEqual(despues.pagos, cuentaAntes.pagos);
    assert.deepEqual(despues.cuenta, cuentaAntes.cuenta);

    const registros = await auditorias();
    assert.equal(registros.length, 2);
    assert.deepEqual([registros[1].usuario_id, registros[1].entidad, registros[1].detalle], [null, 'huespedes', { cantidad: '1' }]);
    const todo = JSON.stringify(await e.bd.consultar('SELECT * FROM auditoria'));
    for (const dato of ['Ana Prueba Sintética', '12345678', '+573000000001']) assert.ok(!todo.includes(dato), dato);
  });

  it('no toca estadías recientes ni activas', async () => {
    assert.equal((await huesped(reciente.huesped)).nombre, 'Huésped Prueba Reciente');
    const activos = await e.bd.consultar<{ nombre: string | null }>(
      `SELECT h.nombre FROM huespedes h JOIN estadias s ON s.huesped_id = h.id WHERE s.estado = 'ACTIVA'`);
    assert.ok(activos.length > 0);
    assert.ok(activos.every((x) => x.nombre !== null));
  });

  it('es idempotente: otra corrida no falla ni duplica la auditoría', async () => {
    assert.deepEqual(await anonimizarVencidos(e.bd, new Date('2026-10-09T04:00:00-05:00')), { anonimizados: 0 });
    assert.equal((await auditorias()).length, 2);
  });

  it('la tarea programada corre al arrancar y se detiene', async () => {
    const corridas: number[] = [];
    const detener = programarAnonimizacion(e.bd, () => new Date('2026-10-09T05:00:00-05:00'), {
      cadaMs: 60_000, alTerminar: (r) => corridas.push(r.anonimizados), alFallar: (err) => assert.fail(String(err)),
    });
    await new Promise((r) => setTimeout(r, 50));
    detener();
    assert.deepEqual(corridas, [0]);
  });
});
