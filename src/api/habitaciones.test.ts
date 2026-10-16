// TICKET-01 · FR-01 (lectura). GET /habitaciones según docs/CONTRATO_API.yaml.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let cookie: string;
let dirWebPrueba: string;
before(async () => {
  const dirWeb = await mkdtemp(join(tmpdir(), 'hg-web-'));
  dirWebPrueba = dirWeb;
  await writeFile(join(dirWeb, 'index.html'), '<!doctype html><title>Hotel Golán</title><div id="app"></div>');
  e = await crearEntorno({ dirWeb });
  cookie = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

const pedir = (url: string, conCookie = true) =>
  e.app.inject({ method: 'GET', url, headers: conCookie ? { cookie } : {} });

describe('FR-01 — Mapa de habitaciones', () => {
  it('sin sesión: 401', async () => {
    assert.equal((await pedir('/api/v1/habitaciones', false)).statusCode, 401);
  });

  it('devuelve las 12 habitaciones en orden, con tipo y estado', async () => {
    const r = await pedir('/api/v1/habitaciones');
    assert.equal(r.statusCode, 200);
    const items = r.json().items as Array<{ numero: string; tipo: string; estado: string; nota: string | null }>;
    assert.deepEqual(items.map((h) => h.numero), ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '301']);
    const por = Object.fromEntries(items.map((h) => [h.numero, h]));
    assert.equal(por['201'].tipo, 'AIRE');
    assert.equal(por['205'].tipo, 'VENTILADOR');
    assert.equal(por['207'].estado, 'POR_REVISAR');
    assert.equal(por['301'].estado, 'MANTENIMIENTO');
    assert.equal(por['301'].nota, 'Ducha en reparación');
  });

  it('las ocupadas traen su estadía resumida: saldo, por verificar y salida en hora de Bogotá', async () => {
    const items = (await pedir('/api/v1/habitaciones')).json().items;
    const h205 = items.find((h: { numero: string }) => h.numero === '205');
    const h211 = items.find((h: { numero: string }) => h.numero === '211');
    const h201 = items.find((h: { numero: string }) => h.numero === '201');
    assert.equal(h201.estadia_activa, null);
    assert.equal(h205.estadia_activa.nombre_corto, 'Huésped Prueba');
    assert.equal(h205.estadia_activa.saldo, 0);
    assert.equal(h205.estadia_activa.por_verificar, 0);
    assert.equal(h205.estadia_activa.salida_prevista_en, '2026-10-13T12:00:00-05:00');
    assert.equal(h205.estadia_activa.vencida, false);
    // 211: cargos 84.000 − (efectivo 26.000 + transferencia por verificar 30.000) = 28.000
    assert.equal(h211.estadia_activa.saldo, 28000);
    assert.equal(h211.estadia_activa.por_verificar, 30000);
  });

  it('marca vencida una estadía cuya salida ya pasó', async () => {
    e.fijarHora('2026-10-13T12:30:00-05:00');
    try {
      const items = (await pedir('/api/v1/habitaciones')).json().items;
      assert.equal(items.find((h: { numero: string }) => h.numero === '205').estadia_activa.vencida, true);
    } finally {
      e.fijarHora('2026-10-13T06:10:00-05:00');
    }
  });

  it('filtra por estado', async () => {
    const r = await pedir('/api/v1/habitaciones?estado=OCUPADA');
    assert.deepEqual(r.json().items.map((h: { numero: string }) => h.numero), ['205', '211']);
  });

  it('estado inválido: 400 INVALID_PAYLOAD', async () => {
    const r = await pedir('/api/v1/habitaciones?estado=SUCIA');
    assert.equal(r.statusCode, 400);
    assert.equal(r.json().codigo, 'INVALID_PAYLOAD');
  });
});

describe('Aplicación web servida por la API', () => {
  it('GET / entrega index.html y las rutas de la app caen en index.html', async () => {
    for (const url of ['/', '/habitaciones']) {
      const r = await e.app.inject({ method: 'GET', url });
      assert.equal(r.statusCode, 200);
      assert.match(r.headers['content-type'] as string, /text\/html/);
      assert.match(r.body, /Hotel Golán/);
    }
  });

  it('sirve un archivo publicado después de arrancar (nueva versión sin reiniciar)', async () => {
    await writeFile(join(dirWebPrueba, 'nuevo-123.js'), 'export const v = 1;');
    const r = await e.app.inject({ method: 'GET', url: '/nuevo-123.js' });
    assert.equal(r.statusCode, 200);
    assert.match(r.headers['content-type'] as string, /javascript/);
  });

  it('un archivo que no existe responde 404, no la página principal', async () => {
    const r = await e.app.inject({ method: 'GET', url: '/assets/no-existe-abc.js' });
    assert.equal(r.statusCode, 404);
    assert.equal(r.json().codigo, 'NO_ENCONTRADO');
  });
});
