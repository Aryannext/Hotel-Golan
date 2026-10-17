// TICKET-04 · POST /estadias, GET /estadias y GET /estadias/{id} (FR-03, FR-05; RN-02, RN-05, RN-06, RN-16) según docs/CONTRATO_API.yaml.
// Solo datos sintéticos («Huésped Prueba NN», documentos PRUEBA…).
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T20:00:00-05:00');
  cookie = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

const entrada = (o: Record<string, unknown> = {}) => ({
  habitacion_numero: '206', modalidad: 'NOCHE', personas: 2, noches: 1,
  huesped: { nombre: 'Huésped Prueba 30', tipo_documento: 'CC', numero_documento: 'PRUEBA12345678', nacionalidad: 'Colombia', es_menor: false },
  autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' },
  pago: { forma: 'EFECTIVO', valor_recibido: 60000 },
  ...o,
});
const registrar = (payload: Record<string, unknown>, clave?: string, c: string | null = cookie) => e.app.inject({
  method: 'POST', url: '/api/v1/estadias', payload,
  headers: { ...(c ? { cookie: c } : {}), ...(clave ? { 'idempotency-key': clave } : {}) },
});
const contar = async (sql: string, p: unknown[] = []) => (await e.bd.consultar<{ n: number }>(sql, p))[0].n;
const estadoHabitacion = async (n: string) =>
  (await e.bd.consultar<{ estado: string }>('SELECT estado FROM habitaciones WHERE numero = $1', [n]))[0].estado;

describe('RN-06, RN-16, FR-05 — Registro de la entrada', () => {
  it('sin sesión: 401', async () => {
    assert.equal((await registrar(entrada(), undefined, null)).statusCode, 401);
  });

  it('entrada pagada en efectivo: estadía ACTIVA, cargo de 55.000, pago EN_CAJA y habitación OCUPADA', async () => {
    const r = await registrar(entrada());
    assert.equal(r.statusCode, 201);
    const est = r.json();
    assert.deepEqual(
      [est.habitacion_numero, est.modalidad, est.personas, est.noches, est.estado, est.forma_cobro, est.salida_real_en],
      ['206', 'NOCHE', 2, 1, 'ACTIVA', 'ANTICIPADO', null]);
    assert.equal(est.entrada_en, '2026-10-13T20:00:00-05:00');
    assert.equal(est.salida_prevista_en, '2026-10-14T12:00:00-05:00');
    assert.deepEqual(est.cargos.map((c: Record<string, unknown>) => [c.tipo, c.cantidad, c.valor_unitario, c.valor, c.creado_por, c.anulado]),
      [['ALOJAMIENTO', 1, 55000, 55000, 'recepcion2', false]]);
    assert.equal(est.pagos.length, 1);
    const p = est.pagos[0];
    assert.deepEqual([p.medio, p.valor, p.estado, p.registrado_por, p.turno_id, p.habitacion_numero, p.anulado],
      ['EFECTIVO', 55000, 'EN_CAJA', 'recepcion2', e.semilla.turnoId, '206', false]);
    assert.deepEqual(est.cuenta, { total_cargos: 55000, pagado: 55000, por_verificar: 0, saldo: 0, a_favor: 0 });
    assert.equal(await estadoHabitacion('206'), 'OCUPADA');

    const [aut] = await e.bd.consultar<{ version_aviso: string; otorgada_en: Date; usuario: string }>(
      `SELECT a.version_aviso, a.otorgada_en, u.usuario FROM autorizaciones_datos a
         JOIN estadias es ON es.huesped_id = a.huesped_id JOIN usuarios u ON u.id = a.registrada_por WHERE es.id = $1`, [est.id]);
    assert.deepEqual([aut.version_aviso, new Date(aut.otorgada_en).toISOString(), aut.usuario],
      ['AV-2026-10', new Date('2026-10-13T20:00:00-05:00').toISOString(), 'recepcion2']);

    const caja = (await e.app.inject({ method: 'GET', url: '/api/v1/turnos/actual', headers: { cookie } })).json().caja;
    assert.equal(caja.efectivo, 26000 + 55000);
    assert.equal(caja.debe_haber, 234500 + 55000);
  });

  it('el documento sale enmascarado (••••678) y nunca completo; la auditoría no guarda datos personales', async () => {
    const r = await registrar(entrada({ habitacion_numero: '208' }));
    const est = r.json();
    assert.deepEqual(est.huesped, {
      id: est.huesped.id, nombre_mostrado: 'Huésped Prueba 30', tipo_documento: 'CC',
      documento_enmascarado: '••••678', nacionalidad: 'Colombia', anonimizado: false,
    });
    assert.ok(!r.body.includes('PRUEBA12345678'));
    const [aud] = await e.bd.consultar<{ detalle: unknown }>(
      `SELECT detalle FROM auditoria WHERE accion = 'CREAR' AND entidad = 'estadias' AND entidad_id = $1`, [est.id]);
    assert.ok(aud);
    assert.ok(!JSON.stringify(aud.detalle).includes('Prueba 30') && !JSON.stringify(aud.detalle).includes('PRUEBA1234'));
    const ev = await contar(`SELECT count(*)::int AS n FROM eventos_salida WHERE tipo = 'estadia.creada' AND payload->>'entidad_id' = $1`, [est.id]);
    assert.equal(ev, 1);
  });

  it('sin autorización de datos no se registra: 422 AUTORIZACION_REQUERIDA y nada cambia', async () => {
    const antes = await contar('SELECT count(*)::int AS n FROM estadias');
    const r = await registrar(entrada({ habitacion_numero: '209', autorizacion: { otorgada: false, version_aviso: 'AV-2026-10' } }));
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().codigo, 'AUTORIZACION_REQUERIDA');
    assert.equal(await contar('SELECT count(*)::int AS n FROM estadias'), antes);
    assert.equal(await estadoHabitacion('209'), 'DISPONIBLE');
  });

  it('menor de edad sin acompañante verificado: 400 INVALID_PAYLOAD', async () => {
    const huesped = { nombre: 'Huésped Prueba 31', tipo_documento: 'TI', numero_documento: 'PRUEBA0031', nacionalidad: 'Colombia', es_menor: true, acompanante_verificado: false };
    const r = await registrar(entrada({ habitacion_numero: '209', huesped }));
    assert.equal(r.statusCode, 400);
    assert.equal(r.json().codigo, 'INVALID_PAYLOAD');
    const sinCampo = { ...huesped } as Record<string, unknown>;
    delete sinCampo.acompanante_verificado;
    assert.equal((await registrar(entrada({ habitacion_numero: '209', huesped: sinCampo }))).statusCode, 400);
  });

  it('el documento es opcional, pero un número sin tipo de documento es 400', async () => {
    const huesped = { nombre: 'Huésped Prueba 32', numero_documento: 'PRUEBA0032', nacionalidad: 'Colombia', es_menor: false };
    assert.equal((await registrar(entrada({ habitacion_numero: '209', huesped }))).statusCode, 400);
  });

  it('pagar al salir se permite con una noche: forma_cobro AL_SALIR, sin pago y saldo igual a la tarifa', async () => {
    const huesped = { nombre: 'Huésped Prueba 33', nacionalidad: 'Colombia', es_menor: false };
    const r = await registrar(entrada({ habitacion_numero: '209', personas: 1, huesped, pago: { forma: 'AL_SALIR' } }));
    assert.equal(r.statusCode, 201);
    const est = r.json();
    assert.equal(est.forma_cobro, 'AL_SALIR');
    assert.equal(est.huesped.documento_enmascarado, null);
    assert.deepEqual(est.pagos, []);
    assert.deepEqual(est.cuenta, { total_cargos: 45000, pagado: 0, por_verificar: 0, saldo: 45000, a_favor: 0 });
  });

  it('varias noches o tres horas no se pagan al salir: 422 PAGO_AL_SALIR_NO_PERMITIDO', async () => {
    const r = await registrar(entrada({ habitacion_numero: '210', noches: 3, pago: { forma: 'AL_SALIR' } }));
    assert.equal(r.statusCode, 422);
    assert.equal(r.json().codigo, 'PAGO_AL_SALIR_NO_PERMITIDO');
    const t = await registrar(entrada({ habitacion_numero: '210', modalidad: 'TRES_HORAS', pago: { forma: 'AL_SALIR' } }));
    assert.equal(t.json().codigo, 'PAGO_AL_SALIR_NO_PERMITIDO');
    assert.equal(await estadoHabitacion('210'), 'DISPONIBLE');
  });

  it('no se asigna una habitación ocupada ni una en limpieza: 409 HABITACION_NO_DISPONIBLE', async () => {
    for (const n of ['205', '204']) {
      const r = await registrar(entrada({ habitacion_numero: n }));
      assert.equal(r.statusCode, 409);
      assert.equal(r.json().codigo, 'HABITACION_NO_DISPONIBLE');
    }
  });

  it('dos entradas a la vez en la misma habitación: solo una se registra', async () => {
    const [a, b] = await Promise.all([
      registrar(entrada({ habitacion_numero: '201' })),
      registrar(entrada({ habitacion_numero: '201', huesped: { nombre: 'Huésped Prueba 34', nacionalidad: 'Colombia', es_menor: false } })),
    ]);
    assert.deepEqual([a.statusCode, b.statusCode].sort(), [201, 409]);
    assert.equal(await contar(`SELECT count(*)::int AS n FROM estadias WHERE habitacion_numero = '201'`), 1);
  });

  it('el descuento queda como cargo DESCUENTO aparte y el servidor recalcula el precio', async () => {
    const r = await registrar(entrada({
      habitacion_numero: '202', personas: 1, noches: 2, aplicar_descuento: true, pago: { forma: 'EFECTIVO', valor_recibido: 120000 },
    }));
    assert.equal(r.statusCode, 201);
    const est = r.json();
    assert.deepEqual(est.cargos.map((c: Record<string, unknown>) => [c.tipo, c.cantidad, c.valor_unitario, c.valor]),
      [['ALOJAMIENTO', 2, 60000, 120000], ['DESCUENTO', 2, -5000, -10000]]);
    assert.equal(est.pagos[0].valor, 110000);
    assert.equal(est.salida_prevista_en, '2026-10-15T12:00:00-05:00');
    assert.deepEqual(est.cuenta, { total_cargos: 110000, pagado: 110000, por_verificar: 0, saldo: 0, a_favor: 0 });
    assert.equal((await registrar(entrada({ habitacion_numero: '203', total: 1000 }))).statusCode, 400);
  });

  it('efectivo menor que el total queda como abono y el resto como saldo', async () => {
    const huesped = { nombre: 'Huésped Prueba 35', nacionalidad: 'Venezuela', es_menor: false };
    const r = await registrar(entrada({ habitacion_numero: '203', personas: 1, huesped, pago: { forma: 'EFECTIVO', valor_recibido: 20000 } }));
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().pagos[0].valor, 20000);
    assert.deepEqual(r.json().cuenta, { total_cargos: 60000, pagado: 20000, por_verificar: 0, saldo: 40000, a_favor: 0 });
  });

  it('pago por Nequi: queda POR_VERIFICAR, no entra a la caja y la habitación se entrega igual', async () => {
    const huesped = { nombre: 'Huésped Prueba 36', nacionalidad: 'Colombia', es_menor: false };
    const r = await registrar(entrada({ habitacion_numero: '210', personas: 1, huesped, pago: { forma: 'NEQUI' } }));
    assert.equal(r.statusCode, 201);
    const est = r.json();
    assert.deepEqual([est.pagos[0].medio, est.pagos[0].valor, est.pagos[0].estado], ['NEQUI', 45000, 'POR_VERIFICAR']);
    assert.deepEqual(est.cuenta, { total_cargos: 45000, pagado: 0, por_verificar: 45000, saldo: 0, a_favor: 0 });
    assert.equal(await estadoHabitacion('210'), 'OCUPADA');
    assert.equal(await contar(`SELECT count(*)::int AS n FROM eventos_salida WHERE tipo = 'pago.por_verificar'`), 1);
    const huesped2 = { nombre: 'Huésped Prueba 37', nacionalidad: 'Colombia', es_menor: false };
    const conValor = await registrar(entrada({ habitacion_numero: '209', huesped: huesped2, pago: { forma: 'BANCOLOMBIA', valor_recibido: 50000 } }));
    assert.equal(conValor.statusCode, 400);
  });

  // El registro tardío (talonario, ADR-010) se prueba en registro-tardio.test.ts (TICKET-18).
});

describe('FR-03 — Idempotencia: un doble toque no duplica el registro', () => {
  it('reenviar con la misma Idempotency-Key devuelve la misma estadía y existe un solo pago', async () => {
    const clave = '7f3c2a1e-5b4d-4c8e-9a10-2f6b8d3e4c51';
    const huesped = { nombre: 'Huésped Prueba 38', nacionalidad: 'Colombia', es_menor: false };
    await e.bd.consultar(`UPDATE habitaciones SET estado = 'DISPONIBLE', nota = NULL WHERE numero = '207'`);
    const p = entrada({ habitacion_numero: '207', personas: 1, huesped, pago: { forma: 'EFECTIVO', valor_recibido: 45000 } });
    const a = await registrar(p, clave);
    const b = await registrar(p, clave);
    assert.deepEqual([a.statusCode, b.statusCode], [201, 201]);
    assert.equal(b.json().id, a.json().id);
    assert.equal(await contar(`SELECT count(*)::int AS n FROM estadias WHERE habitacion_numero = '207'`), 1);
    assert.equal(await contar('SELECT count(*)::int AS n FROM pagos WHERE estadia_id = $1', [a.json().id]), 1);
    // Otra persona no puede reutilizar la clave.
    const otra = await registrar(p, clave, await e.entrar('recepcion3'));
    assert.equal(otra.statusCode, 409);
  });
});

describe('Consultar estadías', () => {
  it('GET /estadias?estado=ACTIVA lista las activas con total y paginación', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/estadias?estado=ACTIVA&limite=2', headers: { cookie } });
    assert.equal(r.statusCode, 200);
    const activas = await contar(`SELECT count(*)::int AS n FROM estadias WHERE estado = 'ACTIVA'`);
    assert.equal(r.json().total, activas);
    assert.equal(r.json().items.length, 2);
    assert.ok(r.json().items.every((x: { estado: string }) => x.estado === 'ACTIVA'));
  });

  it('GET /estadias/{id} devuelve la cuenta de la semilla (211: debe 28.000 con 30.000 por verificar)', async () => {
    const [s] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '211' AND estado = 'ACTIVA'`);
    const r = await e.app.inject({ method: 'GET', url: `/api/v1/estadias/${s.id}`, headers: { cookie: await e.entrar('admin') } });
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json().cuenta, { total_cargos: 84000, pagado: 26000, por_verificar: 30000, saldo: 28000, a_favor: 0 });
  });

  it('una estadía que no existe: 404; un id mal formado: 400', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/api/v1/estadias/00000000-0000-4000-8000-000000000000', headers: { cookie } });
    assert.equal(r.statusCode, 404);
    assert.equal((await e.app.inject({ method: 'GET', url: '/api/v1/estadias/abc', headers: { cookie } })).statusCode, 400);
  });
});

describe('RN-09 — Sin turno abierto no se registran entradas', () => {
  it('con el turno por recibir: 409 SIN_TURNO_ABIERTO', async () => {
    const otro = await crearEntorno();
    try {
      await otro.bd.consultar(
        `UPDATE turnos SET estado = 'CERRADO', fin_en = now(), pago_tomado = true, efectivo_esperado = 0, efectivo_contado = 0`);
      await otro.bd.consultar(`INSERT INTO turnos (tipo, estado, base_entregada) VALUES ('DIA', 'POR_RECIBIR', 184500)`);
      const r = await otro.app.inject({
        method: 'POST', url: '/api/v1/estadias', payload: entrada({ habitacion_numero: '209' }), headers: { cookie: await otro.entrar('recepcion1') },
      });
      assert.equal(r.statusCode, 409);
      assert.equal(r.json().codigo, 'SIN_TURNO_ABIERTO');
    } finally {
      await otro.cerrar();
    }
  });
});
