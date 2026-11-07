// HG-HAL-001 HAL-46 (BD-11, SEC-12) y ADR-011 · la tarea programada también purga lo técnico que solo crece: las
// sesiones vencidas o cerradas hace más de 30 días y los eventos ya publicados de más de 30 días. Nada de dinero.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';
import { purgarTecnico } from './privacidad/anonimizacion.ts';

let e: Entorno;
before(async () => { e = await crearEntorno(); });
after(async () => e.cerrar());

const contar = async (sql: string) => (await e.bd.consultar<{ n: number }>(sql))[0].n;
const dias = (n: number) => new Date(Date.now() + n * 86_400_000);

describe('HAL-46 — purga de sesiones y eventos', () => {
  it('borra las sesiones que vencieron hace más de 30 días y los eventos publicados de más de 30 días', async () => {
    await e.entrar('recepcion1'); // una sesión vigente
    const [{ id: usuario }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM usuarios WHERE usuario = 'recepcion2'`);
    await e.bd.consultar(`INSERT INTO sesiones (usuario_id, token_hash, creada_en, expira_en) VALUES ($1, 'vieja', now() - interval '45 days', now() - interval '44 days')`, [usuario]);
    await e.bd.consultar(`INSERT INTO eventos_salida (tipo, payload, ocurrido_en, publicado_en) VALUES ('habitacion.actualizada', '{}', now() - interval '40 days', now() - interval '40 days')`);
    await e.bd.consultar(`INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ('habitacion.actualizada', '{}', now() - interval '40 days')`);
    const sesiones = await contar('SELECT count(*)::int AS n FROM sesiones');
    const eventos = await contar('SELECT count(*)::int AS n FROM eventos_salida');

    const r = await purgarTecnico(e.bd, dias(0));
    assert.deepEqual([r.sesiones, r.eventos], [1, 1]);
    assert.equal(await contar('SELECT count(*)::int AS n FROM sesiones'), sesiones - 1);
    // El evento sin publicar se queda: todavía no le llegó a nadie.
    assert.equal(await contar('SELECT count(*)::int AS n FROM eventos_salida'), eventos - 1);
    assert.equal(await contar(`SELECT count(*)::int AS n FROM sesiones WHERE token_hash = 'vieja'`), 0);
  });
});
