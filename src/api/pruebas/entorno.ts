// Entorno de prueba: PGlite en memoria con el esquema real y la semilla sintética, y un reloj controlable.
// Con PRUEBAS_DATABASE_URL (la CI, HG-HAL-001 HAL-35), cada entorno usa una base nueva en ese PostgreSQL real, que se
// borra al cerrar: así las pruebas también pasan con conexiones y bloqueos de verdad.
import { randomBytes } from 'node:crypto';
import { conectarPglite, conectarPostgres, type Bd } from '../../../scripts/lib/bd.ts';
import { aplicarMigraciones } from '../../../scripts/lib/migraciones.ts';
import { sembrar, type ResumenSemilla } from '../../../scripts/lib/semilla.ts';
import { construirApp, type App } from '../app.ts';

export const PIN_PRUEBA = '135790';

export interface Entorno {
  app: App;
  bd: Bd;
  semilla: ResumenSemilla;
  /** Fija la hora «actual» que ve la API (ISO con desfase, p. ej. 2026-10-13T06:10:00-05:00). */
  fijarHora(iso: string): void;
  avanzarMinutos(min: number): void;
  /** Inicia sesión y devuelve la cookie lista para enviar en `headers.cookie`. */
  entrar(usuario: string, pin?: string): Promise<string>;
  cerrar(): Promise<void>;
}

/** Una base vacía para una prueba: PGlite en memoria o, con PRUEBAS_DATABASE_URL, una base nueva en PostgreSQL. */
export async function baseDePrueba(): Promise<{ bd: Bd; borrar: () => Promise<void> }> {
  const url = process.env.PRUEBAS_DATABASE_URL;
  if (!url) {
    const bd = await conectarPglite();
    return { bd, borrar: () => bd.cerrar() };
  }
  const nombre = `prueba_${randomBytes(6).toString('hex')}`;
  const admin = conectarPostgres(url);
  await admin.ejecutar(`CREATE DATABASE ${nombre}`);
  const destino = new URL(url);
  destino.pathname = `/${nombre}`;
  const bd = conectarPostgres(destino.toString());
  return {
    bd,
    async borrar() {
      await bd.cerrar();
      await admin.ejecutar(`DROP DATABASE IF EXISTS ${nombre} WITH (FORCE)`);
      await admin.cerrar();
    },
  };
}

export async function crearEntorno(opciones: { dirWeb?: string } = {}): Promise<Entorno> {
  const { bd, borrar } = await baseDePrueba();
  await aplicarMigraciones(bd);
  const semilla = await sembrar(bd, PIN_PRUEBA);
  let ahora = new Date('2026-10-13T06:10:00-05:00').getTime();
  const app = await construirApp({ bd, ahora: () => new Date(ahora), dirWeb: opciones.dirWeb });
  return {
    app, bd, semilla,
    fijarHora(iso) { ahora = new Date(iso).getTime(); },
    avanzarMinutos(min) { ahora += min * 60_000; },
    async entrar(usuario, pin = PIN_PRUEBA) {
      const r = await app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { usuario, pin } });
      if (r.statusCode !== 201) throw new Error(`No pudo entrar ${usuario}: ${r.statusCode} ${r.body}`);
      const c = r.cookies.find((x) => x.name === 'sesion');
      return `sesion=${c?.value}`;
    },
    async cerrar() {
      await app.close();
      await borrar();
    },
  };
}

/**
 * Entorno con recepción (recepcion2) y administración ya dentro a la hora dada, y la estadía activa de la 205 de la
 * semilla: la preparación que comparten varias pruebas.
 */
export async function entornoConSesiones(hora: string) {
  const e = await crearEntorno();
  e.fijarHora(hora);
  const recepcion = await e.entrar('recepcion2');
  const admin = await e.entrar('admin');
  const [{ id: e205 }] = await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '205' AND estado = 'ACTIVA'`);
  return { e, recepcion, admin, e205 };
}
