// RN-15: fecha inicial del informe, independiente de la zona horaria del dispositivo.
import { pesos } from './logica.ts';
export const diaHotelActual = (ahora = Date.now()) => new Date(ahora - (5 * 60 + 390) * 60_000).toISOString().slice(0, 10);
export const fechaReporte = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
export function errorRango(desde: string, hasta: string): string | null {
  const valida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!valida(desde) || !valida(hasta)) return 'Elija dos fechas válidas.';
  return desde > hasta ? 'La fecha inicial debe ser anterior o igual a la final.' : null;
}

/** ADR-010 (V5-16): si lo registrado después (un registro tardío, una anulación) cambió lo que debía haber, lo explica. */
export function textoAjuste(c: { diferencia: number; diferencia_ajustada: number; efectivo_esperado_ajustado: number }): string | null {
  if (c.diferencia_ajustada === c.diferencia) return null;
  return `Con lo que se registró después (por ejemplo, una entrada del talonario) debía haber ${pesos(c.efectivo_esperado_ajustado)}: la diferencia queda en ${pesos(c.diferencia_ajustada)}.`;
}
