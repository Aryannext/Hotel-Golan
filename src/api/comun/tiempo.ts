// Colombia está en UTC−5 todo el año (sin horario de verano). Las respuestas usan ese desfase (CONTRATO_API, FechaHora).
const DESFASE_MS = -5 * 3600_000;

/** Fecha en ISO 8601 con desfase -05:00, sin milisegundos. Ej.: 2026-10-13T12:00:00-05:00 */
export function aBogota(fecha: Date): string {
  return new Date(fecha.getTime() + DESFASE_MS).toISOString().slice(0, 19) + '-05:00';
}
