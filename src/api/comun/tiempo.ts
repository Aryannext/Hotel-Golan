// Colombia está en UTC−5 todo el año (sin horario de verano). Las respuestas usan ese desfase (CONTRATO_API, FechaHora).
const DESFASE_MS = -5 * 3_600_000;

/** Fecha en ISO 8601 con desfase -05:00, sin milisegundos. Ej.: 2026-10-13T12:00:00-05:00 */
export function aBogota(fecha: Date): string {
  return new Date(fecha.getTime() + DESFASE_MS).toISOString().slice(0, 19) + '-05:00';
}

/** Hora en palabras, en Bogotá: «6:20 a. m.», «12:00 m.», «1:30 p. m.» (igual que en la PWA). */
export function horaTexto(fecha: Date): string {
  const [hh, mm] = aBogota(fecha).slice(11, 16).split(':').map(Number);
  if (hh === 12 && mm === 0) return '12:00 m.';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'a. m.' : 'p. m.'}`;
}
