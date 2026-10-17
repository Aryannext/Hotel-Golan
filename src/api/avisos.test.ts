// TICKET-16 · aceptación de los avisos (FR-23) con la semilla: la PWA los calcula con GET /habitaciones y GET /reglas.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';
import { calcularAvisos } from '../web/avisos.ts';

let e: Entorno;
let recepcion: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T06:10:00-05:00');
  recepcion = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

const leer = async (url: string) => (await e.app.inject({ method: 'GET', url: `/api/v1${url}`, headers: { cookie: recepcion } })).json();

describe('FR-23 — avisos de la semilla', () => {
  it('211 con transferencia por verificar, 207 por revisar y 204 en limpieza; sin nombres de huéspedes', async () => {
    const avisos = calcularAvisos((await leer('/habitaciones')).items, await leer('/reglas'), Date.parse('2026-10-13T06:10:00-05:00'));
    const titulos = avisos.map((a) => a.titulo);
    assert.ok(titulos.includes('Hab. 211: transferencia por verificar de $30.000'), titulos.join(' | '));
    assert.ok(titulos.includes('Hab. 207: por revisar'));
    assert.ok(titulos.includes('Hab. 204: en limpieza'));
    assert.ok(!JSON.stringify(avisos).includes('Huésped'));
  });

  it('una salida vencida aparece con solo avanzar el reloj, con el valor por hora de las reglas', async () => {
    const { items } = await leer('/habitaciones');
    const ocupada = items.find((h: { estadia_activa: { salida_prevista_en: string } | null }) => h.estadia_activa)!;
    const salida = Date.parse(ocupada.estadia_activa.salida_prevista_en);
    const reglas = await leer('/reglas');
    assert.ok(!calcularAvisos(items, reglas, salida - 60_000).some((a) => a.clave === `vencida-${ocupada.numero}`));
    const vencida = calcularAvisos(items, reglas, salida + 30 * 60_000).find((a) => a.clave === `vencida-${ocupada.numero}`)!;
    assert.equal(vencida.titulo, `Hab. ${ocupada.numero}: la salida venció hace 30 min`);
    assert.match(vencida.detalle, /Corre \$8\.000 por hora/);
  });
});
