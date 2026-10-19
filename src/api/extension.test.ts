// TICKET-07 · POST /estadias/{id}/extensiones y su cotización (FR-08; RN-04) según docs/CONTRATO_API.yaml.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
before(async () => {
  e = await crearEntorno();
  cookie = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

/** Estadía sintética de 1 persona que entra el 11/10 a las 3:00 p. m. y sale el 12/10 a las 12 m. Deja el reloj a las 11:50 a. m. del 12. */
async function estadiaQueSaleAlMediodia(hab: string, personas = 1): Promise<string> {
  e.fijarHora('2026-10-11T15:00:00-05:00');
  const r = await e.app.inject({
    method: 'POST', url: '/api/v1/estadias', headers: { cookie },
    payload: {
      habitacion_numero: hab, modalidad: 'NOCHE', personas, huesped: { nombre: `Huésped Prueba ${hab}`, tipo_documento: 'CC', numero_documento: 'PRUEBA0099', nacionalidad: 'Colombia', es_menor: false },
      autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'AL_SALIR' },
    },
  });
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(r.json().salida_prevista_en, '2026-10-12T12:00:00-05:00');
  e.fijarHora('2026-10-12T11:50:00-05:00');
  return r.json().id;
}
const extender = (id: string, payload: Record<string, unknown>, clave?: string) => e.app.inject({
  method: 'POST', url: `/api/v1/estadias/${id}/extensiones`, payload, headers: { cookie, ...(clave ? { 'idempotency-key': clave } : {}) },
});
const cotizar = (id: string, payload: Record<string, unknown>) =>
  e.app.inject({ method: 'POST', url: `/api/v1/estadias/${id}/extensiones/cotizacion`, payload, headers: { cookie } });

describe('RN-04, FR-08 — Extender después del mediodía (aire, 1 persona, salida 12 m., son las 11:50 a. m.)', () => {
  const ejemplos: Array<[string, number, number, string]> = [
    ['201', 1, 8000, '2026-10-12T13:00:00-05:00'],
    ['202', 4, 32000, '2026-10-12T16:00:00-05:00'],
    ['203', 5, 60000, '2026-10-13T12:00:00-05:00'],
  ];
  for (const [hab, horas, valor, salida] of ejemplos) {
    it(`${horas} hora(s) → cargo EXTENSION de $${valor} y nueva salida ${salida}`, async () => {
      const id = await estadiaQueSaleAlMediodia(hab);
      const r = await extender(id, { modalidad: 'POR_HORAS', horas });
      assert.equal(r.statusCode, 201);
      const cargo = r.json().cargos.at(-1);
      assert.deepEqual([cargo.tipo, cargo.valor, cargo.creado_por], ['EXTENSION', valor, 'recepcion2']);
      assert.equal(r.json().salida_prevista_en, salida);
      assert.equal(r.json().cuenta.saldo, 60000 + valor);
    });
  }
});

describe('RN-04 — Cotizar y aplicar extensiones', () => {
  it('la cotización avisa que pasa de las 4:00 p. m. y no cambia nada', async () => {
    const id = await estadiaQueSaleAlMediodia('206');
    const r = await cotizar(id, { modalidad: 'POR_HORAS', horas: 6 });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json(), { modalidad_cobrada: 'NOCHE', valor: 45000, salida_prevista_en: '2026-10-13T12:00:00-05:00', pasa_de_las_4: true });
    const est = (await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${id}`, headers: { cookie } })).json();
    assert.deepEqual([est.cargos.length, est.salida_prevista_en], [1, '2026-10-12T12:00:00-05:00']);
  });

  it('otra noche: 24 horas más con la tarifa por personas; el cargo dice «otra noche» y se audita', async () => {
    const id = await estadiaQueSaleAlMediodia('208', 2);
    const r = await extender(id, { modalidad: 'NOCHE' });
    assert.equal(r.statusCode, 201);
    const cargo = r.json().cargos.at(-1);
    assert.deepEqual([cargo.tipo, cargo.concepto, cargo.valor], ['EXTENSION', 'Extensión: otra noche', 55000]);
    assert.equal(r.json().salida_prevista_en, '2026-10-13T12:00:00-05:00');
    const [a] = await e.bd.consultar<{ n: number }>(
      `SELECT count(*)::int AS n FROM auditoria WHERE accion = 'ACTUALIZAR' AND entidad = 'estadias' AND entidad_id = $1 AND detalle->>'accion' = 'EXTENSION'`, [id]);
    assert.equal(a.n, 1);
  });

  it('por horas que pasan de las 4:00 p. m.: el cargo dice que se cobra la noche completa', async () => {
    const id = await estadiaQueSaleAlMediodia('209');
    const r = await extender(id, { modalidad: 'POR_HORAS', horas: 5 });
    assert.equal(r.json().cargos.at(-1).concepto, 'Extensión: pasa de las 4:00 p. m., noche completa');
    assert.equal(r.json().cargos.at(-1).valor, 45000);
  });

  it('tres horas con 3 personas: 422 CAPACIDAD_EXCEDIDA', async () => {
    const id = await estadiaQueSaleAlMediodia('210', 3);
    const r = await extender(id, { modalidad: 'TRES_HORAS' });
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().codigo, 'CAPACIDAD_EXCEDIDA');
  });

  it('por horas sin horas, horas con otra modalidad o más de 12: 400; estadía inexistente: 404', async () => {
    const [s] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '211' AND estado = 'ACTIVA'`);
    assert.equal((await extender(s.id, { modalidad: 'POR_HORAS' })).statusCode, 400);
    assert.equal((await extender(s.id, { modalidad: 'NOCHE', horas: 2 })).statusCode, 400);
    assert.equal((await extender(s.id, { modalidad: 'POR_HORAS', horas: 13 })).statusCode, 400);
    assert.equal((await extender('00000000-0000-4000-8000-000000000000', { modalidad: 'NOCHE' })).statusCode, 404);
  });

  it('con Idempotency-Key, un doble toque extiende una sola vez', async () => {
    const [s] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '205' AND estado = 'ACTIVA'`);
    const clave = '8d9e0f1a-2b3c-4d4e-9f5a-6b7c8d9e0f1a';
    const a = await extender(s.id, { modalidad: 'NOCHE' }, clave);
    const b = await extender(s.id, { modalidad: 'NOCHE' }, clave);
    assert.deepEqual([a.statusCode, b.statusCode], [201, 201]);
    assert.equal(b.json().salida_prevista_en, a.json().salida_prevista_en);
    const [n] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM cargos WHERE estadia_id = $1 AND tipo = 'EXTENSION'`, [s.id]);
    assert.equal(n.n, 1);
  });

  it('una estadía cerrada no se extiende: 409', async () => {
    await e.bd.consultar(`UPDATE habitaciones SET estado = 'DISPONIBLE', nota = NULL WHERE numero = '204'`);
    const id = await estadiaQueSaleAlMediodia('204');
    await e.bd.consultar(`UPDATE estadias SET estado = 'CERRADA', salida_real_en = now() WHERE id = $1`, [id]);
    assert.equal((await extender(id, { modalidad: 'NOCHE' })).statusCode, 409);
  });
});
