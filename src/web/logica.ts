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

export type Modalidad = 'NOCHE' | 'TRES_HORAS';

/** RN-02 / RN-03: máximo 3 personas por noche y 2 en tres horas. */
export const maxPersonas = (m: Modalidad) => (m === 'TRES_HORAS' ? 2 : 3);
export const ajustarPersonas = (personas: number, m: Modalidad) => Math.min(maxPersonas(m), Math.max(1, personas));

/** «mañana a las 12:00 m.», «hoy a la 1:30 a. m.» (en español se dice «a la una»). */
export function textoSalida(iso: string, hoy: string): string {
  const hora = horaBogota(iso);
  return `${diaRelativo(iso, hoy)} ${hora.startsWith('1:') ? 'a la' : 'a las'} ${hora}`;
}

// TICKET-03 · recibir el turno y caja.
/** Lee lo que escribe recepción («184.500», «$ 183000»); sin números devuelve null. */
export function leerPesos(texto: string): number | null {
  const d = texto.replace(/\D/g, '');
  return d ? Number(d) : null;
}

export function diferenciaConteo(contado: number, entregado: number): { tono: 'exito' | 'alerta'; texto: string } {
  const d = contado - entregado;
  if (d === 0) return { tono: 'exito', texto: 'Sin diferencia' };
  return { tono: 'alerta', texto: `${d < 0 ? 'Faltan' : 'Sobran'} ${pesos(Math.abs(d))}` };
}

export const nombreTurno = (tipo: 'DIA' | 'NOCHE') =>
  tipo === 'DIA' ? 'de día · 6:30 a. m. a 6:30 p. m.' : 'de noche · 6:30 p. m. a 6:30 a. m.';
