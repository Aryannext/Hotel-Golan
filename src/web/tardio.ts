// Registro tardío en la PWA (TICKET-18, ADR-010). Sin JSX, se prueba con node --test.
// Las horas van siempre en Bogotá (UTC−5, sin horario de verano), sin depender de la zona del celular.
import { horaBogota } from './logica.ts';
import { fechaReporte } from './reportes.ts';

const DESFASE_MS = 5 * 3_600_000;
const LIMITE_MS = 48 * 3_600_000;

/** «2026-10-13T06:10»: el formato de un campo datetime-local, en hora de Bogotá. */
export const aLocalBogota = (ms: number) => new Date(ms - DESFASE_MS).toISOString().slice(0, 16);

export const limitesTardio = (ahora: number) => ({ min: aLocalBogota(ahora - LIMITE_MS), max: aLocalBogota(ahora) });

/** Lo escrito en el campo, con el desfase de Bogotá; null si no es una fecha y hora reales. */
export function entradaIso(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const iso = `${valor}:00-05:00`;
  const ms = Date.parse(iso);
  // Una fecha imposible (30 de febrero) se corre de día al convertirla: no coincide al volver a Bogotá.
  return Number.isNaN(ms) || aLocalBogota(ms) !== valor ? null : iso;
}

export function errorTardio(valor: string, ahora: number): string | null {
  const iso = entradaIso(valor);
  if (!iso) return 'Escriba el día y la hora real en que entró el huésped (está en el talonario).';
  const ms = Date.parse(iso);
  if (ms > ahora) return 'Esa hora todavía no ha pasado. Revise el día y la hora del talonario.';
  if (ahora - ms > LIMITE_MS) return 'Solo se pueden pasar entradas de las últimas 48 horas. Avise a la administración.';
  return null;
}

export function textoTardio(e: { entrada_en: string; registrada_por: string; registrada_en: string }): string {
  const texto = `Registro tardío: entró el ${fechaReporte(e.entrada_en)} a las ${horaBogota(e.entrada_en)}; lo digitó ${e.registrada_por} el ${fechaReporte(e.registrada_en)} a las ${horaBogota(e.registrada_en)}`;
  // «a. m.», «p. m.» y «m.» ya terminan en punto.
  return texto.endsWith('.') ? texto : `${texto}.`;
}
