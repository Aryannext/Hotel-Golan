// TICKET-05 · GET /eventos por SSE (FR-15; ADR-005, ADR-011): el aviso llega a recepción en menos de 5 s, sin datos personales.
// Estas pruebas abren un puerto local real, porque una respuesta SSE no termina y `inject` esperaría para siempre.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let base: string;
let recepcion: string;
let admin: string;
before(async () => {
  e = await crearEntorno();
  await e.app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(e.app.server.address() as AddressInfo).port}/api/v1`;
  recepcion = await e.entrar('recepcion1');
  admin = await e.entrar('admin');
});
after(async () => e.cerrar());

interface Mensaje { id: string; event: string; data: Record<string, unknown> }

/** Abre /eventos y va guardando los mensajes; `esperar` resuelve cuando llega uno del tipo pedido. */
async function suscribir(cookie: string, ultimoId?: string) {
  const control = new AbortController();
  const r = await fetch(`${base}/eventos`, {
    headers: { cookie, accept: 'text/event-stream', ...(ultimoId ? { 'last-event-id': ultimoId } : {}) }, signal: control.signal,
  });
  const recibidos: Mensaje[] = [];
  let avisar = () => {};
  (async () => {
    const lector = r.body!.pipeThrough(new TextDecoderStream()).getReader();
    let resto = '';
    try {
      for (;;) {
        const { value, done } = await lector.read();
        if (done) return;
        resto += value;
        let corte: number;
        while ((corte = resto.indexOf('\n\n')) >= 0) {
          const bloque = resto.slice(0, corte);
          resto = resto.slice(corte + 2);
          const campo = (n: string) => bloque.split('\n').find((l) => l.startsWith(n + ': '))?.slice(n.length + 2);
          const data = campo('data');
          if (data) recibidos.push({ id: campo('id') ?? '', event: campo('event') ?? '', data: JSON.parse(data) });
          avisar();
        }
      }
    } catch { /* cerrado */ }
  })();
  return {
    respuesta: r,
    recibidos,
    esperar(tipo: string, ms = 5000): Promise<Mensaje> {
      return new Promise((resolver, rechazar) => {
        const revisar = () => { const m = recibidos.find((x) => x.event === tipo); if (m) { clearTimeout(t); resolver(m); } };
        const t = setTimeout(() => rechazar(new Error(`No llegó ${tipo} en ${ms} ms`)), ms);
        avisar = revisar;
        revisar();
      });
    },
    cerrar: () => control.abort(),
  };
}

describe('RN-12, FR-15, SSE — Eventos en tiempo real', () => {
  it('sin sesión: 401', async () => {
    assert.equal((await fetch(`${base}/eventos`)).status, 401);
  });

  it('la recepción suscrita recibe pago.verificado en menos de 5 s cuando la administradora confirma', async () => {
    const s = await suscribir(recepcion);
    try {
      assert.equal(s.respuesta.status, 200);
      assert.match(s.respuesta.headers.get('content-type') ?? '', /^text\/event-stream/);
      const inicio = Date.now();
      const r = await e.app.inject({
        method: 'POST', url: `/api/v1/pagos/${e.semilla.pagoPorVerificarId}/verificacion`, payload: { resultado: 'LLEGO' }, headers: { cookie: admin },
      });
      assert.equal(r.statusCode, 200);
      const m = await s.esperar('pago.verificado');
      assert.ok(Date.now() - inicio < 5000);
      assert.match(m.id, /^\d+$/);
      assert.deepEqual(m.data, {
        id: m.id, tipo: 'pago.verificado', ocurrido_en: m.data.ocurrido_en,
        habitacion_numero: '211', entidad_id: e.semilla.pagoPorVerificarId, valor: 30000,
      });
      assert.match(String(m.data.ocurrido_en), /-05:00$/);
    } finally {
      s.cerrar();
    }
  });

  it('el aviso de diferencia de caja (turno.diferencia) solo llega a la administración', async () => {
    const rec = await suscribir(recepcion);
    const adm = await suscribir(admin);
    try {
      await e.bd.consultar(`INSERT INTO eventos_salida (tipo, payload) VALUES ('turno.diferencia', $1)`,
        [JSON.stringify({ turno_id: e.semilla.turnoId, base_entregada: 184500, base_contada: 183000, diferencia: -1500, recibido_por: 'recepcion2' })]);
      await e.bd.consultar(`INSERT INTO eventos_salida (tipo, payload) VALUES ('habitacion.actualizada', $1)`,
        [JSON.stringify({ numero: '207', estado: 'DISPONIBLE' })]);
      const m = await adm.esperar('turno.diferencia');
      assert.equal(m.data.entidad_id, e.semilla.turnoId);
      await adm.esperar('habitacion.actualizada');
      const h = await rec.esperar('habitacion.actualizada');
      assert.equal(h.data.habitacion_numero, '207');
      assert.ok(!rec.recibidos.some((x) => x.event === 'turno.diferencia'));
    } finally {
      rec.cerrar();
      adm.cerrar();
    }
  });

  it('al reconectar con Last-Event-ID recibe lo que se perdió', async () => {
    const [ultimo] = await e.bd.consultar<{ id: string }>(`SELECT max(id)::text AS id FROM eventos_salida`);
    await e.bd.consultar(`INSERT INTO eventos_salida (tipo, payload) VALUES ('habitacion.actualizada', $1)`,
      [JSON.stringify({ numero: '204', estado: 'DISPONIBLE' })]);
    const s = await suscribir(recepcion, ultimo.id);
    try {
      const m = await s.esperar('habitacion.actualizada');
      assert.equal(m.data.habitacion_numero, '204');
      assert.ok(BigInt(m.id) > BigInt(ultimo.id));
      assert.equal(s.recibidos.filter((x) => x.data.habitacion_numero === '204').length, 1);
    } finally {
      s.cerrar();
    }
  });
});
