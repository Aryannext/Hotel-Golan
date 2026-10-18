// Fecha prevista de una solicitud de factura (RN-23): el contador tarda de 1 a 3 días hábiles y no trabaja sábados,
// domingos ni festivos (administradora, HG-ACT-001 V5-09 y V5-10). Los festivos de Colombia siguen la Ley 51 de 1983
// (trasladables al lunes) [P].
import { aBogota } from '../comun/tiempo.ts';

const DIA_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fecha = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes - 1, dia));
const masDias = (d: Date, n: number) => new Date(d.getTime() + n * DIA_MS);
/** El mismo día si es lunes; si no, el lunes siguiente. */
const alLunes = (d: Date) => masDias(d, (8 - d.getUTCDay()) % 7);

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
function pascua(anio: number): Date {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fecha(anio, mes, dia);
}

/** Festivos de Colombia de un año, ordenados (AAAA-MM-DD). */
export function festivosColombia(anio: number): string[] {
  const p = pascua(anio);
  const fijos = [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]].map(([m, d]) => fecha(anio, m, d));
  const trasladables = [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => alLunes(fecha(anio, m, d)));
  const religiosos = [masDias(p, -3), masDias(p, -2), masDias(p, 43), masDias(p, 64), masDias(p, 71)];
  return [...fijos, ...trasladables, ...religiosos].map(iso).sort((a, b) => a.localeCompare(b));
}

/** El n-ésimo día hábil (lunes a viernes, sin festivos) después del día en Bogotá en que se pidió. */
function diaHabil(momento: Date, n: number): string {
  let d = new Date(`${aBogota(momento).slice(0, 10)}T00:00:00Z`);
  // También los del año siguiente: una solicitud de fin de diciembre pasa a enero.
  const festivos = new Set([...festivosColombia(d.getUTCFullYear()), ...festivosColombia(d.getUTCFullYear() + 1)]);
  for (let contados = 0; contados < n;) {
    d = masDias(d, 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !festivos.has(iso(d))) contados++;
  }
  return iso(d);
}

/** Desde cuándo puede estar lista: el primer día hábil después de pedirla. */
export const fechaPrevista = (momento: Date) => diaHabil(momento, 1);
/** Hasta cuándo: el tercer día hábil (V5-09). */
export const fechaPrevistaHasta = (momento: Date) => diaHabil(momento, 3);
