// HG-HAL-001, hallazgos medios de la base de datos y la API. Datos sintéticos.
// - HAL-23: un extranjero ya anonimizado no queda «por reportar a Migración» para siempre.
// - HAL-22: si una regla falta en la base (migración sin correr), cambiarla responde 409 y no un 200 que no hizo nada.
// - HAL-36: las consultas por estadía, huésped, turno, venta, pedido y usuario tienen índice.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entornoConSesiones, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
let admin: string;
let e205: string;
before(async () => { ({ e, recepcion, admin, e205 } = await entornoConSesiones('2026-10-13T06:15:00-05:00')); });
after(async () => e.cerrar());

const pendientes = async () => (await e.app.inject({ method: 'GET', url: '/api/v1/migracion/pendientes', headers: { cookie: recepcion } })).json().items as Array<{ estadia_id: string }>;

describe('HAL-23 — extranjeros anonimizados', () => {
  it('un extranjero sin reportar aparece; ya anonimizado, no (no hay datos que reportar)', async () => {
    await e.bd.consultar(`UPDATE huespedes SET nacionalidad = 'Venezuela' WHERE id = (SELECT huesped_id FROM estadias WHERE id = $1)`, [e205]);
    assert.ok((await pendientes()).some((p) => p.estadia_id === e205));
    await e.bd.consultar(`UPDATE huespedes SET nombre = NULL, tipo_documento = NULL, numero_documento = NULL, anonimizado_en = now()
                           WHERE id = (SELECT huesped_id FROM estadias WHERE id = $1)`, [e205]);
    assert.ok(!(await pendientes()).some((p) => p.estadia_id === e205));
  });
});

describe('HAL-22 — una regla que falta en la base', () => {
  it('PATCH /reglas sobre una regla que no está: 409 con el aviso de correr las migraciones', async () => {
    await e.bd.consultar(`DELETE FROM reglas WHERE clave = 'minutos_cambio_sin_cargo'`);
    const r = await e.app.inject({ method: 'PATCH', url: '/api/v1/reglas', headers: { cookie: admin }, payload: { minutos_cambio_sin_cargo: 7 } });
    assert.equal(r.statusCode, 409, r.body);
    assert.match(r.json().mensaje, /migraciones/);
  });
});

describe('HAL-36 — índices', () => {
  it('existen los índices de las consultas por estadía, huésped, turno, venta, pedido y usuario', async () => {
    const filas = await e.bd.consultar<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'`);
    const hay = (tabla: string, columna: string) => filas.some((f) => new RegExp(`ON public\\.${tabla} USING btree \\(${columna}\\)`).test(f.indexdef));
    for (const [tabla, columna] of [['cargos', 'estadia_id'], ['pagos', 'estadia_id'], ['ventas_items', 'venta_id'], ['pedidos_lavanderia_items', 'pedido_id'],
      ['pedidos_lavanderia', 'estadia_id'], ['estadias', 'huesped_id'], ['estadias', 'turno_id'], ['sesiones', 'usuario_id']]) {
      assert.ok(hay(tabla, columna), `falta índice en ${tabla}(${columna})`);
    }
  });
});
