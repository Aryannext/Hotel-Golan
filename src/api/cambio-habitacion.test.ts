// TICKET-26 · cambio de habitación (FR-30; RN-17). Reglas de la administradora (HG-ACT-001 V5-03 a V5-05):
// a los pocos minutos de entrar (sin usarla) se ajusta la diferencia, a favor o en contra; si ya la usó, antes de las
// 12 m. se cobra la habitación nueva completa; después de las 12 m., no se cambia. Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
let admin: string;

const pedir = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown, cookie = recepcion) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie } });
const entrar = async (hora: string) => {
  e.fijarHora(hora);
  recepcion = await e.entrar('recepcion2');
  admin = await e.entrar('admin');
};
const entrada = async (habitacion: string, valor: number) => {
  const r = await pedir('POST', '/estadias', {
    habitacion_numero: habitacion, modalidad: 'NOCHE', personas: 1,
    huesped: { nombre: `Huésped Prueba ${habitacion}`, nacionalidad: 'Colombia', es_menor: false },
    autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: valor },
  });
  assert.equal(r.statusCode, 201, r.body);
  return r.json().id as string;
};
const estadoHab = async (n: string) => (await e.bd.consultar<{ estado: string }>('SELECT estado FROM habitaciones WHERE numero = $1', [n]))[0].estado;
const activa = async (n: string) => (await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = $1 AND estado = 'ACTIVA'`, [n]))[0].id;
const cambiar = (id: string, habitacion: string) => pedir('POST', `/estadias/${id}/cambio-habitacion`, { habitacion_numero: habitacion });
const cotizar = (id: string, habitacion: string) => pedir('POST', `/estadias/${id}/cambio-habitacion/cotizacion`, { habitacion_numero: habitacion });
const debeHaber = async () => (await pedir('GET', '/turnos/actual')).json().caja.debe_haber as number;

before(async () => { e = await crearEntorno(); });
after(async () => e.cerrar());

describe('RN-17 (V5-03, V5-05) — cambia de opinión a los pocos minutos de entrar', () => {
  it('de ventilador (206) a aire (201) a los 3 minutos: paga la diferencia de $15.000', async () => {
    await entrar('2026-10-13T15:00:00-05:00');
    const id = await entrada('206', 45000);
    e.avanzarMinutos(3);
    const c = await cotizar(id, '201');
    assert.equal(c.statusCode, 200, c.body);
    assert.deepEqual([c.json().tipo, c.json().diferencia, c.json().devolucion], ['SIN_USO', 15000, 0]);
    const r = await cambiar(id, '201');
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().habitacion_numero, r.json().cuenta.saldo], ['201', 15000]);
    // El alojamiento anterior se anula con motivo y se carga el de la nueva habitación (sin borrar nada, ADR-008).
    const cargos = r.json().cargos as Array<{ tipo: string; concepto: string; valor: number; anulado: boolean }>;
    assert.ok(cargos.some((x) => x.tipo === 'ALOJAMIENTO' && x.anulado && x.valor === 45000));
    assert.ok(cargos.some((x) => x.tipo === 'ALOJAMIENTO' && !x.anulado && x.valor === 60000 && x.concepto.includes('cambio de la 206 a la 201')));
    assert.deepEqual([await estadoHab('201'), await estadoHab('206')], ['OCUPADA', 'POR_REVISAR']);
  });

  it('de aire (202) a ventilador (209) a los 4 minutos: se le devuelven $15.000 en efectivo y la cuenta queda en $0', async () => {
    await entrar('2026-10-13T15:10:00-05:00');
    const id = await entrada('202', 60000);
    const antes = await debeHaber();
    e.avanzarMinutos(4);
    assert.deepEqual([(await cotizar(id, '209')).json().diferencia, (await cotizar(id, '209')).json().devolucion], [-15000, 15000]);
    const r = await cambiar(id, '209');
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().cuenta.saldo, r.json().cuenta.a_favor, r.json().cuenta.devuelto], [0, 0, 15000]);
    assert.equal(await debeHaber(), antes - 15000);
  });

  it('el límite de minutos se configura en Ajustes (minutos_cambio_sin_cargo)', async () => {
    await entrar('2026-10-13T15:20:00-05:00');
    assert.equal((await pedir('GET', '/reglas')).json().minutos_cambio_sin_cargo, 5);
    assert.equal((await pedir('PATCH', '/reglas', { minutos_cambio_sin_cargo: 2 }, admin)).statusCode, 200);
    const id = await entrada('203', 60000);
    e.avanzarMinutos(3);
    // Pasaron 3 minutos (> 2) y ya es después de las 12 m.: no se cambia.
    const r = await cambiar(id, '210');
    assert.equal(r.statusCode, 409);
    assert.equal(await estadoHab('203'), 'OCUPADA');
    await pedir('PATCH', '/reglas', { minutos_cambio_sin_cargo: 5 }, admin);
  });
});

describe('RN-17 (V5-04) — ya usó la habitación', () => {
  it('antes de las 12 m. se cobra la habitación nueva completa y la salida se recalcula', async () => {
    await entrar('2026-10-14T10:00:00-05:00');
    const id = await activa('205');
    const c = (await cotizar(id, '208')).json();
    assert.deepEqual([c.tipo, c.diferencia, c.salida_prevista_en], ['NOCHE_NUEVA', 55000, '2026-10-15T12:00:00-05:00']);
    const r = await cambiar(id, '208');
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual([r.json().habitacion_numero, r.json().salida_prevista_en], ['208', '2026-10-15T12:00:00-05:00']);
    assert.deepEqual([await estadoHab('208'), await estadoHab('205')], ['OCUPADA', 'POR_REVISAR']);
  });

  it('después de las 12 m. no se cambia: 409 y nada cambia', async () => {
    await entrar('2026-10-14T12:01:00-05:00');
    const id = await activa('211');
    const r = await cambiar(id, '210');
    assert.equal(r.statusCode, 409);
    assert.match(r.json().mensaje, /12/);
    assert.equal(await estadoHab('211'), 'OCUPADA');
  });
});

describe('FR-30 — habitación destino y registro', () => {
  it('a una habitación ocupada o a la misma: 409', async () => {
    await entrar('2026-10-14T09:00:00-05:00');
    const id = await activa('208');
    assert.equal((await cambiar(id, '201')).json().codigo, 'HABITACION_NO_DISPONIBLE');
    assert.equal((await cambiar(id, '208')).statusCode, 409);
  });

  it('queda en la auditoría con origen, destino y valor, sin datos del huésped', async () => {
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE entidad = 'estadias' AND detalle->>'accion' = 'CAMBIO_HABITACION' ORDER BY id LIMIT 1`);
    assert.deepEqual([a.detalle.de, a.detalle.a, a.detalle.valor], ['206', '201', '15000']);
  });

  it('la estadía avisa si tiene ropa en lavandería sin entregar (para «Dar salida»)', async () => {
    const id = await activa('208');
    assert.equal((await pedir('GET', `/estadias/${id}`)).json().lavanderia_por_entregar, 0);
    const prenda = (await e.bd.consultar<{ id: string }>(`SELECT id FROM productos WHERE nombre = 'Buso'`))[0].id;
    await pedir('POST', `/estadias/${id}/lavanderia`, { items: [{ producto_id: prenda, cantidad: 1 }] });
    assert.equal((await pedir('GET', `/estadias/${id}`)).json().lavanderia_por_entregar, 1);
  });
});
