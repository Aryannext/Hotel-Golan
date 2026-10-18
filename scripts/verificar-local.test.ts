// Verifica la Fase 1.5 sin Docker: aplica la migración y la semilla en PGlite (PostgreSQL embebido en memoria)
// y comprueba las restricciones del modelo y el simulador Inbox/Outbox.
// Uso: npm run db:verificar
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { conectarPglite, type Bd } from './lib/bd.ts';
import { aplicarMigraciones } from './lib/migraciones.ts';
import { sembrar, type ResumenSemilla } from './lib/semilla.ts';
import { verificarPago } from './lib/verificacion.ts';

let bd: Bd;
let semilla: ResumenSemilla;
const uno = async <T>(sql: string, params?: unknown[]) => (await bd.consultar<T>(sql, params))[0];
// Exige el código SQLSTATE exacto para no aceptar un rechazo por otra causa (p. ej., un error de sintaxis).
// 23505 = viola un índice único; 23514 = viola un CHECK.
const falla = (codigo: '23505' | '23514', sql: string, params?: unknown[]) =>
  assert.rejects(bd.consultar(sql, params), (e: { code?: string }) => e.code === codigo);

before(async () => {
  bd = await conectarPglite();
  await aplicarMigraciones(bd);
  semilla = await sembrar(bd, '135790');
});
after(async () => bd.cerrar());

describe('Semilla sintética', () => {
  it('carga las 12 habitaciones, 8 tarifas, 7 reglas y 6 usuarios', async () => {
    const c = await uno<{ h: number; t: number; r: number; u: number }>(`SELECT
      (SELECT count(*)::int FROM habitaciones) h, (SELECT count(*)::int FROM tarifas) t,
      (SELECT count(*)::int FROM reglas) r, (SELECT count(*)::int FROM usuarios) u`);
    assert.deepEqual(c, { h: 12, t: 8, r: 7, u: 6 }); // la 7.ª, minutos_cambio_sin_cargo, la crea la migración 0007
  });

  it('guarda el PIN como hash Argon2id, nunca en claro', async () => {
    const { pin_hash } = await uno<{ pin_hash: string }>(`SELECT pin_hash FROM usuarios WHERE usuario = 'recepcion1'`);
    assert.match(pin_hash, /^\$argon2id\$/);
    assert.ok(!pin_hash.includes('135790'));
  });

  it('solo usa documentos de prueba', async () => {
    const { n } = await uno<{ n: number }>(`SELECT count(*)::int n FROM huespedes WHERE numero_documento NOT LIKE 'PRUEBA%'`);
    assert.equal(n, 0);
  });
});

describe('Caja del turno (RN-10)', () => {
  it('debe haber $234.500: base $208.500 + efectivo $26.000; transferencias $85.000 aparte', async () => {
    const c = await uno<{ efectivo: number; transferencias: number; debe_haber: number }>(`
      SELECT sum(p.valor) FILTER (WHERE p.medio = 'EFECTIVO')::int AS efectivo,
             sum(p.valor) FILTER (WHERE p.medio <> 'EFECTIVO' AND p.estado <> 'RECHAZADO')::int AS transferencias,
             (t.base_recibida + coalesce(sum(p.valor) FILTER (WHERE p.medio = 'EFECTIVO'), 0)
              - (SELECT coalesce(sum(valor), 0) FROM movimientos_caja m WHERE m.turno_id = t.id AND m.anulado_en IS NULL))::int AS debe_haber
        FROM turnos t JOIN pagos p ON p.turno_id = t.id AND p.anulado_en IS NULL
       WHERE t.id = $1 GROUP BY t.id, t.base_recibida`, [semilla.turnoId]);
    assert.deepEqual(c, { efectivo: 26000, transferencias: 85000, debe_haber: 234500 });
  });
});

describe('Restricciones del modelo', () => {
  it('impide un segundo turno activo (RN-09)', () =>
    falla('23505', `INSERT INTO turnos (tipo, estado, base_entregada) VALUES ('DIA', 'POR_RECIBIR', 0)`));

  it('impide dos estadías activas en la misma habitación', async () => {
    const { huesped_id, turno_id, creada_por } = await uno<Record<string, string>>(
      `SELECT huesped_id, turno_id, creada_por FROM estadias WHERE habitacion_numero = '205'`);
    await falla('23505', `INSERT INTO estadias (habitacion_numero, huesped_id, turno_id, modalidad, personas, entrada_en, salida_prevista_en, forma_cobro, creada_por)
                 VALUES ('205', $1, $2, 'NOCHE', 1, now(), now() + interval '1 day', 'ANTICIPADO', $3)`, [huesped_id, turno_id, creada_por]);
  });

  it('tres horas admite máximo 2 personas (RN-03) y pagar al salir solo con una noche (RN-06)', async () => {
    const { huesped_id, turno_id, creada_por } = await uno<Record<string, string>>(
      `SELECT huesped_id, turno_id, creada_por FROM estadias WHERE habitacion_numero = '205'`);
    await falla('23514', `INSERT INTO estadias (habitacion_numero, huesped_id, turno_id, modalidad, personas, entrada_en, salida_prevista_en, forma_cobro, creada_por)
                 VALUES ('201', $1, $2, 'TRES_HORAS', 3, now(), now() + interval '3 hours', 'ANTICIPADO', $3)`, [huesped_id, turno_id, creada_por]);
    await falla('23514', `INSERT INTO estadias (habitacion_numero, huesped_id, turno_id, modalidad, personas, noches, entrada_en, salida_prevista_en, forma_cobro, creada_por)
                 VALUES ('201', $1, $2, 'NOCHE', 1, 2, now(), now() + interval '2 days', 'AL_SALIR', $3)`, [huesped_id, turno_id, creada_por]);
  });

  it('el efectivo no puede quedar «por verificar» y el descuento no puede ser positivo', async () => {
    const { id, turno_id, creada_por } = await uno<Record<string, string>>(
      `SELECT id, turno_id, creada_por FROM estadias WHERE habitacion_numero = '205'`);
    await falla('23514', `INSERT INTO pagos (estadia_id, turno_id, medio, valor, estado, registrado_por) VALUES ($1, $2, 'EFECTIVO', 1000, 'POR_VERIFICAR', $3)`, [id, turno_id, creada_por]);
    await falla('23514', `INSERT INTO cargos (estadia_id, tipo, concepto, valor_unitario, valor, creado_por) VALUES ($1, 'DESCUENTO', 'Descuento', 5000, 5000, $2)`, [id, creada_por]);
  });

  it('un menor necesita acompañante verificado (RN-16)', () =>
    falla('23514', `INSERT INTO huespedes (nombre, nacionalidad, es_menor, acompanante_verificado) VALUES ('Menor Prueba', 'Colombia', true, false)`));

  it('una entrega que no cuadra exige motivo (RN-11)', () =>
    falla('23514', `UPDATE turnos SET estado = 'CERRADO', fin_en = now(), pago_tomado = true, efectivo_esperado = 184500, efectivo_contado = 180000 WHERE id = $1`, [semilla.turnoId]));
});

describe('Simulador de verificación (opción B, Inbox/Outbox)', () => {
  it('confirma la transferencia, deja auditoría y evento, y no se repite con la misma clave', async () => {
    const { id: admin } = await uno<{ id: string }>(`SELECT id FROM usuarios WHERE usuario = 'admin'`);
    const clave = '7f3c2a1e-5b4d-4c8e-9a10-2f6b8d3e4c51';
    const primera = await verificarPago(bd, { pagoId: semilla.pagoPorVerificarId, resultado: 'LLEGO', usuarioId: admin, clave });
    const segunda = await verificarPago(bd, { pagoId: semilla.pagoPorVerificarId, resultado: 'LLEGO', usuarioId: admin, clave });
    assert.equal(primera.estado, 'VERIFICADO');
    assert.equal(primera.repetida, false);
    assert.equal(segunda.repetida, true);
    const c = await uno<{ eventos: number; auditoria: number }>(`SELECT
      (SELECT count(*)::int FROM eventos_salida WHERE tipo = 'pago.verificado') eventos,
      (SELECT count(*)::int FROM auditoria WHERE accion = 'VERIFICAR') auditoria`);
    assert.deepEqual(c, { eventos: 1, auditoria: 1 });
  });

  it('no permite verificar dos veces un pago ya verificado con otra clave', async () => {
    const { id: admin } = await uno<{ id: string }>(`SELECT id FROM usuarios WHERE usuario = 'admin'`);
    await assert.rejects(
      verificarPago(bd, { pagoId: semilla.pagoPorVerificarId, resultado: 'NO_LLEGO', usuarioId: admin, clave: '0b8f6c2d-1a3e-4f5b-8c7d-9e0f1a2b3c4d' }),
      /CONFLICTO/);
  });
});
