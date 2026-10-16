// Lógica de presentación sin JSX; la usan los componentes y se prueba con node --test.
const CLASES: Record<string, string> = {
  DISPONIBLE: 'libre', OCUPADA: 'ocupada', POR_REVISAR: 'revisar', LIMPIEZA: 'limpieza', MANTENIMIENTO: 'fuera',
};
const TEXTOS: Record<string, string> = {
  DISPONIBLE: 'Disponible', OCUPADA: 'Ocupada', POR_REVISAR: 'Por revisar', LIMPIEZA: 'Limpieza', MANTENIMIENTO: 'Mantenimiento',
};

export const claseEstado = (estado: string) => CLASES[estado] ?? 'libre';
export const textoEstado = (estado: string) => TEXTOS[estado] ?? estado;

export const pesos = (n: number) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Lee la hora directamente del texto ISO con -05:00, para no depender de la zona horaria del equipo. */
export function horaBogota(iso: string): string {
  const [hh, mm] = iso.slice(11, 16).split(':').map(Number);
  if (hh === 12 && mm === 0) return '12:00 m.';
  const sufijo = hh < 12 ? 'a. m.' : 'p. m.';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${sufijo}`;
}

/** «hoy», «mañana» o «dd/mm», comparando con la fecha de referencia (AAAA-MM-DD, en Bogotá). */
export function diaRelativo(iso: string, hoy: string): string {
  const fecha = iso.slice(0, 10);
  if (fecha === hoy) return 'hoy';
  const manana = new Date(Date.parse(hoy + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
  if (fecha === manana) return 'mañana';
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

export function contarEstados(items: Array<{ estado: string }>) {
  const n = (...e: string[]) => items.filter((h) => e.includes(h.estado)).length;
  return { disponibles: n('DISPONIBLE'), ocupadas: n('OCUPADA'), limpiezaORevision: n('LIMPIEZA', 'POR_REVISAR'), mantenimiento: n('MANTENIMIENTO') };
}

/** Fecha de hoy en Bogotá (UTC−5), AAAA-MM-DD. */
export const hoyBogota = (ahora = Date.now()) => new Date(ahora - 5 * 3600_000).toISOString().slice(0, 10);

/** Dos iniciales para el avatar: «Recepción Prueba 2» → «RP». */
export const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
