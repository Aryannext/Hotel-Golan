// HG-HAL-001 HAL-02 · el sistema arranca en una base vacía sin la semilla ficticia: catálogo base del hotel (habitaciones,
// tarifas, reglas y productos informados), una sola cuenta de administración y un turno «por recibir» con la base
// inicial. Desde ahí, la administración crea a recepción y recepción recibe el turno. Datos de prueba sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { conectarPglite, type Bd } from '../../scripts/lib/bd.ts';
import { aplicarMigraciones } from '../../scripts/lib/migraciones.ts';
import { iniciarHotel } from '../../scripts/lib/inicio.ts';
import { construirApp, type App } from './app.ts';

let bd: Bd;
let app: App;
const ahora = new Date('2026-11-01T18:00:00-05:00');
const PIN_ADMIN = '246813';
before(async () => {
  bd = await conectarPglite();
  await aplicarMigraciones(bd);
  app = await construirApp({ bd, ahora: () => ahora });
});
after(async () => { await app.close(); await bd.cerrar(); });

const entrar = async (usuario: string, pin: string) => {
  const r = await app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { usuario, pin } });
  assert.equal(r.statusCode, 201, r.body);
  return `sesion=${r.cookies.find((c) => c.name === 'sesion')?.value}`;
};

describe('HAL-02 — arrancar sin la semilla', () => {
  it('deja el catálogo base, una cuenta de administración y un turno de noche por recibir con la base', async () => {
    const r = await iniciarHotel(bd, { nombre: 'Administración Prueba', usuario: 'admin.prueba', pin: PIN_ADMIN, baseInicial: 150000, turno: 'NOCHE', ahora });
    assert.deepEqual(r, { habitaciones: 12, tarifas: 8, productos: 15 });
    const [u] = await bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM usuarios');
    assert.equal(u.n, 1);
    const [{ n: estadias }] = await bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM estadias');
    assert.equal(estadias, 0);
  });

  it('la administración entra, crea a recepción y recepción recibe el turno y puede cotizar', async () => {
    const admin = await entrar('admin.prueba', PIN_ADMIN);
    const hab = await app.inject({ method: 'GET', url: '/api/v1/habitaciones', headers: { cookie: admin } });
    assert.equal(hab.json().items.length, 12);
    assert.ok(hab.json().items.every((h: { estado: string }) => h.estado === 'DISPONIBLE'));
    const nueva = await app.inject({ method: 'POST', url: '/api/v1/usuarios', headers: { cookie: admin },
      payload: { nombre: 'Recepción Prueba', usuario: 'recepcion.prueba', rol: 'RECEPCION', pin: '975310' } });
    assert.equal(nueva.statusCode, 201, nueva.body);

    const recepcion = await entrar('recepcion.prueba', '975310');
    const recibir = await app.inject({ method: 'POST', url: '/api/v1/turnos/actual/recepcion', headers: { cookie: recepcion }, payload: { base_contada: 150000 } });
    assert.equal(recibir.statusCode, 200, recibir.body);
    assert.deepEqual([recibir.json().estado, recibir.json().tipo, recibir.json().base_recibida], ['ABIERTO', 'NOCHE', 150000]);
    const cot = await app.inject({ method: 'POST', url: '/api/v1/cotizaciones', headers: { cookie: recepcion },
      payload: { habitacion_numero: '206', modalidad: 'NOCHE', personas: 1 } });
    assert.equal(cot.statusCode, 200, cot.body);
    assert.equal(cot.json().total, 45000);
  });

  it('en una base que ya tiene usuarios no hace nada y avisa', async () => {
    await assert.rejects(
      iniciarHotel(bd, { nombre: 'Otra', usuario: 'otra', pin: '111111', baseInicial: 0, turno: 'DIA', ahora }),
      /ya tiene usuarios/);
  });

  it('pide un PIN de 6 dígitos y una base en pesos enteros', async () => {
    const vacia = await conectarPglite();
    await aplicarMigraciones(vacia);
    await assert.rejects(iniciarHotel(vacia, { nombre: 'A B', usuario: 'ab', pin: '12', baseInicial: 0, turno: 'DIA', ahora }), /6 dígitos/);
    await assert.rejects(iniciarHotel(vacia, { nombre: 'A B', usuario: 'ab', pin: '123456', baseInicial: -1, turno: 'DIA', ahora }), /base/);
    await vacia.cerrar();
  });
});
