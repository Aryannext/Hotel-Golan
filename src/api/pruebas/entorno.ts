// Entorno de prueba: PGlite en memoria con el esquema real y la semilla sintética, y un reloj controlable.
import { conectarPglite, type Bd } from '../../../scripts/lib/bd.ts';
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

export async function crearEntorno(opciones: { dirWeb?: string } = {}): Promise<Entorno> {
  const bd = await conectarPglite();
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
      await bd.cerrar();
    },
  };
}
