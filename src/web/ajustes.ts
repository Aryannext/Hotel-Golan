// Presentación de la configuración (TICKET-15, FR-22). Sin JSX, se prueba con node --test.
import { GRUPOS, horaBogota, leerPesos, pesos } from './logica.ts';

export interface Tarifa { id: string; tipo_habitacion: 'AIRE' | 'VENTILADOR'; modalidad: 'NOCHE' | 'TRES_HORAS'; personas: number; valor: number; vigente_desde: string }
export type TarifaInput = Pick<Tarifa, 'tipo_habitacion' | 'modalidad' | 'personas' | 'valor'>;
export interface Reglas {
  valor_hora: number; hora_noche_completa: number; descuento_noche: number;
  pago_turno_dia: number; pago_turno_noche: number; retencion_datos_dias: number;
}
export type ClaveRegla = keyof Reglas;

/** La administración edita todos los grupos, incluidas las dos vitrinas (FR-24, RN-19). */
export const GRUPOS_EDITABLES = GRUPOS;

/** RN-13 (V5-19): lo que no se registra son los productos de la familiar, por dueño y no por sección. */
export const NOTA_FAMILIAR = 'Los productos de la familiar (champú, crema para el cabello y similares) no se registran ni se cobran aquí, estén en la sección que estén: su plata va aparte.';

/** Pesos escritos por la persona; un signo menos o un texto sin números no es un valor válido. */
const pesosValidos = (texto: string) => (texto.includes('-') ? null : leerPesos(texto));
const enteroValido = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto) : null);

export function etiquetaTarifa(t: Pick<Tarifa, 'tipo_habitacion' | 'modalidad' | 'personas'>): string {
  const tipo = t.tipo_habitacion === 'AIRE' ? 'Aire' : 'Ventilador';
  if (t.modalidad === 'TRES_HORAS') return `${tipo} · tres horas (1 o 2 personas)`;
  return `${tipo} · noche · ${t.personas} persona${t.personas === 1 ? '' : 's'}`;
}

/** Solo las tarifas cuyo valor cambió; cada una crea una vigencia nueva en el servidor. */
export function tarifasCambiadas(actuales: Tarifa[], textos: Record<string, string>) {
  const items: TarifaInput[] = [];
  const errores: Record<string, string> = {};
  for (const t of actuales) {
    if (!(t.id in textos)) continue;
    const valor = pesosValidos(textos[t.id]);
    if (!valor) { errores[t.id] = 'Escriba un valor mayor que $0.'; continue; }
    if (valor !== t.valor) items.push({ tipo_habitacion: t.tipo_habitacion, modalidad: t.modalidad, personas: t.personas, valor });
  }
  return { items, errores };
}

export const textoHora = (hora: number) => horaBogota(`2000-01-01T${String(hora).padStart(2, '0')}:00:00-05:00`);

export const REGLAS: Array<{ clave: ClaveRegla; texto: string; ayuda: string; min: number; max: number; pesos: boolean }> = [
  { clave: 'valor_hora', texto: 'Valor de cada hora extra', ayuda: 'Se cobra la hora empezada.', min: 0, max: 1000000, pesos: true },
  { clave: 'hora_noche_completa', texto: 'Desde qué hora se cobra la noche completa', ayuda: 'Al extender por horas desde esta hora, se cobra la noche.', min: 12, max: 23, pesos: false },
  { clave: 'descuento_noche', texto: 'Descuento máximo por noche', ayuda: 'Recepción puede dar menos, nunca más. Solo si el cliente lo pide; no aplica a tres horas ni a horas.', min: 0, max: 1000000, pesos: true },
  { clave: 'pago_turno_dia', texto: 'Pago del turno de día', ayuda: 'Aplica desde el próximo turno que se abra.', min: 0, max: 10000000, pesos: true },
  { clave: 'pago_turno_noche', texto: 'Pago del turno de noche', ayuda: 'Aplica desde el próximo turno que se abra.', min: 0, max: 10000000, pesos: true },
  { clave: 'retencion_datos_dias', texto: 'Días que se guardan los datos del huésped', ayuda: 'Después de la salida; luego se borran el nombre, el documento y el teléfono.', min: 1, max: 3650, pesos: false },
];

export function textoRegla(clave: string, valor: number): string {
  const r = REGLAS.find((x) => x.clave === clave);
  if (!r) return `${clave}: ${valor}`;
  if (r.clave === 'hora_noche_completa') return `${r.texto}: ${textoHora(valor)}`;
  return `${r.texto}: ${r.pesos ? pesos(valor) : valor}`;
}

/** Solo las reglas que cambiaron, dentro de los límites del contrato. */
export function reglasCambiadas(actuales: Reglas, textos: Record<ClaveRegla, string>) {
  const cambios: Partial<Reglas> = {};
  const errores: Partial<Record<ClaveRegla, string>> = {};
  for (const r of REGLAS) {
    const valor = r.pesos ? pesosValidos(textos[r.clave]) : enteroValido(textos[r.clave]);
    if (valor === null) { errores[r.clave] = 'Escriba un número.'; continue; }
    if (valor < r.min || valor > r.max) { errores[r.clave] = `Debe estar entre ${r.min} y ${r.max}.`; continue; }
    if (valor !== actuales[r.clave]) cambios[r.clave] = valor;
  }
  return { cambios, errores };
}

/** Unidades que llegaron en un surtido: entero de 1 a 10.000. */
export function leerCantidadSurtido(texto: string): { cantidad: number | null; error: string | null } {
  const t = texto.trim();
  const n = /^\d+$/.test(t) ? Number(t) : 0;
  return n >= 1 && n <= 10000 ? { cantidad: n, error: null } : { cantidad: null, error: 'Escriba cuántas unidades llegaron (de 1 a 10.000).' };
}

export function erroresProducto(f: { nombre: string; precio: string }): Partial<Record<'nombre' | 'precio', string>> {
  const e: Partial<Record<'nombre' | 'precio', string>> = {};
  if (f.nombre.trim().length < 2) e.nombre = 'Escriba el nombre (mínimo 2 letras).';
  if (pesosValidos(f.precio) === null) e.precio = 'Escriba el precio en pesos.';
  return e;
}
