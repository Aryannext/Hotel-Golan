// TICKET-18 · registro tardío (ADR-010): pasar al sistema lo anotado en el talonario durante un corte,
// con la hora real de entrada. POST /estadias con `registro_tardio` y `entrada_en` según docs/CONTRATO_API.yaml.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:10:00-05:00');
  cookie = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

const entrada = (o: Record<string, unknown> = {}) => ({
  habitacion_numero: '206', modalidad: 'NOCHE', personas: 1,
  huesped: { nombre: 'Huésped Prueba 60', nacionalidad: 'Colombia', es_menor: false },
  autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' },
  pago: { forma: 'EFECTIVO', valor_recibido: 45000 },
  ...o,
});
const registrar = (payload: Record<string, unknown>) =>
  e.app.inject({ method: 'POST', url: '/api/v1/estadias', payload, headers: { cookie } });

describe('ADR-010 — Registro tardío', () => {
  it('una entrada de hace 3 horas calcula la salida con la hora real (3:10 a. m. → 12 m. del mismo día)', async () => {
    const r = await registrar(entrada({ registro_tardio: true, entrada_en: '2026-10-13T03:10:00-05:00' }));
    assert.equal(r.statusCode, 201, r.body);
    const est = r.json();
    assert.equal(est.entrada_en, '2026-10-13T03:10:00-05:00');
    // Con la hora de digitación (6:10 a. m.) habría sido de 24 horas; con la real, sale a las 12 m. (franja de madrugada).
    assert.equal(est.salida_prevista_en, '2026-10-13T12:00:00-05:00');
    assert.deepEqual([est.registro_tardio, est.registrada_por, est.registrada_en], [true, 'recepcion2', '2026-10-13T06:10:00-05:00']);
    assert.equal(est.cargos.find((c: { tipo: string }) => c.tipo === 'ALOJAMIENTO').valor, 45000);
    // El dinero entra a la caja del turno que digita, a la hora en que se digita.
    assert.equal(est.pagos[0].registrado_en, '2026-10-13T06:10:00-05:00');
    assert.equal(est.pagos[0].turno_id, e.semilla.turnoId);
    const [f] = await e.bd.consultar<{ registro_tardio: boolean }>('SELECT registro_tardio FROM estadias WHERE id = $1', [est.id]);
    assert.equal(f.registro_tardio, true);
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'CREAR' AND entidad = 'estadias' AND entidad_id = $1`, [est.id]);
    assert.equal(a.detalle.registro_tardio, 'si');
  });

  it('el precio es el de la tarifa vigente a la hora real de entrada', async () => {
    await e.bd.consultar(`INSERT INTO tarifas (tipo_habitacion, modalidad, personas, valor, vigente_desde) VALUES ('VENTILADOR', 'NOCHE', 1, 50000, '2026-10-13T05:00:00-05:00')`);
    const r = await registrar(entrada({ habitacion_numero: '208', huesped: { nombre: 'Huésped Prueba 61', nacionalidad: 'Colombia', es_menor: false },
      registro_tardio: true, entrada_en: '2026-10-13T04:30:00-05:00' }));
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(r.json().cargos.find((c: { tipo: string }) => c.tipo === 'ALOJAMIENTO').valor, 45000);
  });

  it('una entrada normal no es tardía y también dice quién la registró', async () => {
    const r = await registrar(entrada({ habitacion_numero: '209', huesped: { nombre: 'Huésped Prueba 62', nacionalidad: 'Colombia', es_menor: false },
      pago: { forma: 'EFECTIVO', valor_recibido: 50000 } }));
    assert.equal(r.statusCode, 201, r.body);
    assert.deepEqual([r.json().registro_tardio, r.json().registrada_por, r.json().entrada_en], [false, 'recepcion2', '2026-10-13T06:10:00-05:00']);
  });

  it('registro tardío sin hora, hora sin registro tardío, más de 48 horas atrás o en el futuro: 400', async () => {
    const h = { habitacion_numero: '210', huesped: { nombre: 'Huésped Prueba 63', nacionalidad: 'Colombia', es_menor: false } };
    const casos = [
      { registro_tardio: true },
      { entrada_en: '2026-10-13T03:10:00-05:00' },
      { registro_tardio: true, entrada_en: '2026-10-11T06:00:00-05:00' },
      { registro_tardio: true, entrada_en: '2026-10-13T06:20:00-05:00' },
    ];
    for (const caso of casos) {
      const r = await registrar(entrada({ ...h, ...caso }));
      assert.equal(r.statusCode, 400, JSON.stringify(caso));
      assert.equal(r.json().codigo, 'INVALID_PAYLOAD');
    }
    const [n] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM estadias WHERE habitacion_numero = '210'`);
    assert.equal(n.n, 0);
  });

  it('justo 48 horas atrás todavía se acepta', async () => {
    const r = await registrar(entrada({ habitacion_numero: '210', huesped: { nombre: 'Huésped Prueba 64', nacionalidad: 'Colombia', es_menor: false },
      registro_tardio: true, entrada_en: '2026-10-11T06:10:00-05:00' }));
    assert.equal(r.statusCode, 201, r.body);
  });
});
