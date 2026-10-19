// TICKET-34 · quiénes se quedan hoy (FR-31; RN-16): la lista que recepción le muestra a la policía cuando pasa de
// rutina, como hoy el talonario (administradora, HG-ACT-001 V5-02). No se envía ni se exporta. Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entornoConSesiones, type Entorno } from './pruebas/entorno.ts';

interface Titular { habitacion_numero: string; nombre: string; tipo_documento: string | null; numero_documento: string | null; entrada_en: string; salida_prevista_en: string }

let e: Entorno;
let recepcion: string;
before(async () => {
  ({ e, recepcion } = await entornoConSesiones('2026-10-13T06:20:00-05:00'));
  // Una estadía antigua sin documento: antes del TICKET-36 el documento era opcional (RN-16). Hoy la API lo exige,
  // así que se registra con documento y luego se le quita, como quedaron las entradas viejas.
  const r = await e.app.inject({ method: 'POST', url: '/api/v1/estadias', headers: { cookie: recepcion }, payload: {
    habitacion_numero: '201', modalidad: 'NOCHE', personas: 1,
    huesped: { nombre: 'Huésped Prueba Sin Documento', tipo_documento: 'CC', numero_documento: 'PRUEBA0099', nacionalidad: 'Colombia', es_menor: false },
    autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 60000 },
  } });
  assert.equal(r.statusCode, 201, r.body);
  await e.bd.consultar(`UPDATE huespedes SET tipo_documento = NULL, numero_documento = NULL
    WHERE id = (SELECT huesped_id FROM estadias WHERE id = $1)`, [r.json().id]);
});
after(async () => e.cerrar());

const lista = (cookie: string | null = recepcion) =>
  e.app.inject({ method: 'GET', url: '/api/v1/huespedes/hoy', headers: cookie ? { cookie } : {} });

describe('FR-31 (V5-02) — quiénes se quedan hoy', () => {
  it('lista las habitaciones ocupadas con el nombre y el documento completo del titular, por habitación', async () => {
    const r = await lista();
    assert.equal(r.statusCode, 200, r.body);
    const items = r.json().items as Titular[];
    assert.deepEqual(items.map((t) => t.habitacion_numero), ['201', '205', '211']);
    const t205 = items.find((t) => t.habitacion_numero === '205')!;
    assert.deepEqual([t205.nombre, t205.tipo_documento, t205.numero_documento], ['Huésped Prueba 01', 'CC', 'PRUEBA0001']);
    const t201 = items.find((t) => t.habitacion_numero === '201')!;
    assert.deepEqual([t201.tipo_documento, t201.numero_documento], [null, null]);
  });

  it('una estadía terminada no aparece', async () => {
    const [{ id }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '201' AND estado = 'ACTIVA'`);
    assert.equal((await e.app.inject({ method: 'POST', url: `/api/v1/estadias/${id}/salida`, headers: { cookie: recepcion } })).statusCode, 200);
    assert.deepEqual(((await lista()).json().items as Titular[]).map((t) => t.habitacion_numero), ['205', '211']);
  });

  it('sin sesión: 401', async () => {
    assert.equal((await lista(null)).statusCode, 401);
  });

  it('cada consulta queda en la auditoría con quién la hizo, sin nombres ni documentos', async () => {
    const filas = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'CONSULTAR' AND entidad = 'huespedes' ORDER BY id`);
    assert.ok(filas.length >= 2);
    const texto = JSON.stringify(filas);
    for (const dato of ['Huésped Prueba', 'PRUEBA0001']) assert.ok(!texto.includes(dato), dato);
    assert.equal(filas.at(-1)!.detalle.cantidad, '2');
  });
});
