// HG-HAL-001 HAL-16 · un cobro y la entrega del turno no se cruzan: si el cobro ya tomó el turno abierto (FOR SHARE),
// la entrega (FOR UPDATE) espera a que termine y lo cuenta. Antes, el cobro podía quedar en un turno ya cerrado, sin
// contarse en lo que debía haber. En la CI corre contra PostgreSQL 16 real (HAL-35); con PGlite, que atiende una
// transacción a la vez, pasa sin probar el bloqueo.
// En la semilla, el turno de noche ABIERTO es de recepcion2: «debe haber» 234.500 y pago del turno 50.000. Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { entornoConSesiones, type Entorno } from './pruebas/entorno.ts';
import { turnoAbiertoId } from './caja/turnos.ts';

let e: Entorno;
let recepcion: string;
let e205: string;
before(async () => { ({ e, recepcion, e205 } = await entornoConSesiones('2026-10-13T06:25:00-05:00')); });
after(async () => e.cerrar());

describe('HAL-16 — cobro y entrega del turno al mismo tiempo', () => {
  it('la entrega espera al cobro que ya tomó el turno y lo cuenta en lo que debe dejar', async () => {
    const [{ id: cajero }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM usuarios WHERE usuario = 'recepcion2'`);
    let avisarTomado = () => {};
    const tomado = new Promise<void>((r) => { avisarTomado = r; });
    const cobro = e.bd.transaccion(async (tx) => {
      const turno = await turnoAbiertoId(tx);
      avisarTomado();
      await new Promise((r) => setTimeout(r, 400)); // mientras tanto, llega la entrega
      await tx.consultar(
        `INSERT INTO pagos (estadia_id, turno_id, medio, valor, estado, registrado_por, registrado_en)
         VALUES ($1, $2, 'EFECTIVO', 10000, 'EN_CAJA', $3, now())`, [e205, turno, cajero]);
    });
    await tomado;
    const entrega = e.app.inject({ method: 'POST', url: '/api/v1/turnos/actual/entrega', headers: { cookie: recepcion },
      payload: { pago_tomado: true, efectivo_contado: 194500 } });
    await cobro;
    const r = await entrega;
    assert.equal(r.statusCode, 200, r.body);
    // 234.500 + 10.000 del cobro − 50.000 del pago del turno = 194.500: el cobro quedó contado.
    assert.equal(r.json().cierre.efectivo_esperado, 194500);
    assert.equal(r.json().cierre.diferencia, 0);
  });
});
