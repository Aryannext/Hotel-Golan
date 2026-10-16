// Núcleo de reglas del hotel (ADR-001): puro, sin base de datos ni red; todo en hora de Bogotá (UTC−5, sin horario de verano).
// Fuente: docs/PRD.md §4.1 — RN-01 (salida por franjas), RN-02/RN-03 (tarifas y personas), RN-05 (descuento), RN-06 (pago al salir).

export type TipoHabitacion = 'AIRE' | 'VENTILADOR';
export type ModalidadCotizable = 'NOCHE' | 'TRES_HORAS';
export type Franja = 'MADRUGADA_MISMO_DIA' | 'VEINTICUATRO_HORAS' | 'MEDIODIA_SIGUIENTE' | 'TRES_HORAS';
export interface Tarifa { tipo_habitacion: TipoHabitacion; modalidad: ModalidadCotizable; personas: number; valor: number }

export class ErrorRegla extends Error {
  readonly codigo: 'CAPACIDAD_EXCEDIDA' | 'DESCUENTO_NO_PERMITIDO';
  constructor(codigo: ErrorRegla['codigo'], mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const HORA_MS = 3600_000;
const DIA_MS = 24 * HORA_MS;
const DESFASE_MS = 5 * HORA_MS;           // Bogotá = UTC−5
const MADRUGADA_HASTA_MIN = 6 * 60;       // hasta las 6:00 a. m. → sale a las 12 m. del mismo día
const VEINTICUATRO_HASTA_MIN = 12 * 60;   // de 6:01 a 11:59 a. m. → 24 horas
const MAX_PERSONAS = { NOCHE: 3, TRES_HORAS: 2 } as const;

/** Minutos desde la medianoche de Bogotá. */
const minutosBogota = (t: Date) => { const l = new Date(t.getTime() - DESFASE_MS); return l.getUTCHours() * 60 + l.getUTCMinutes(); };
/** 12:00 m. de Bogotá del mismo día calendario (en Bogotá) que `t`, desplazado `dias`. */
function mediodiaBogota(t: Date, dias: number): Date {
  const l = new Date(t.getTime() - DESFASE_MS);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + dias, 12) + DESFASE_MS);
}

/** RN-01. Con N noches se suman N−1 días a la salida de la primera noche (N × 24 h en la franja de 24 horas). */
export function calcularSalida(modalidad: ModalidadCotizable, entrada: Date, noches: number): { salida: Date; franja: Franja } {
  if (modalidad === 'TRES_HORAS') return { salida: new Date(entrada.getTime() + 3 * HORA_MS), franja: 'TRES_HORAS' };
  const n = Math.max(1, noches);
  const min = minutosBogota(entrada);
  if (min <= MADRUGADA_HASTA_MIN) return { salida: mediodiaBogota(entrada, n - 1), franja: 'MADRUGADA_MISMO_DIA' };
  if (min < VEINTICUATRO_HASTA_MIN) return { salida: new Date(entrada.getTime() + n * DIA_MS), franja: 'VEINTICUATRO_HORAS' };
  return { salida: mediodiaBogota(entrada, n), franja: 'MEDIODIA_SIGUIENTE' };
}

/** RN-02/RN-03. Tres horas: un solo precio para 1 o 2 personas (fila con personas = 2). */
export function calcularTarifa(tarifas: Tarifa[], tipo: TipoHabitacion, modalidad: ModalidadCotizable, personas: number, noches: number): number {
  const maximo = MAX_PERSONAS[modalidad];
  if (personas > maximo) {
    throw new ErrorRegla('CAPACIDAD_EXCEDIDA', modalidad === 'TRES_HORAS'
      ? 'En las de tres horas entran máximo 2 personas.'
      : 'Máximo 3 personas por habitación. Con 4, ofrezca dos habitaciones.');
  }
  const buscadas = modalidad === 'TRES_HORAS' ? 2 : personas;
  const t = tarifas.find((x) => x.tipo_habitacion === tipo && x.modalidad === modalidad && x.personas === buscadas);
  if (!t) throw new Error(`Falta la tarifa ${tipo} ${modalidad} para ${buscadas} personas`);
  return t.valor * (modalidad === 'NOCHE' ? Math.max(1, noches) : 1);
}

/** RN-05. $5.000 por noche, solo en NOCHE y solo si el cliente lo pide. */
export function calcularDescuento(modalidad: ModalidadCotizable, noches: number, aplicar: boolean, descuentoNoche: number): number {
  if (!aplicar) return 0;
  if (modalidad !== 'NOCHE') throw new ErrorRegla('DESCUENTO_NO_PERMITIDO', 'El descuento solo aplica por noche; no en tres horas ni por horas.');
  return descuentoNoche * Math.max(1, noches);
}

export interface EntradaCotizacion {
  tarifas: Tarifa[]; descuentoNoche: number; tipo: TipoHabitacion; modalidad: ModalidadCotizable;
  personas: number; noches: number; aplicarDescuento: boolean; entrada: Date;
}

export function cotizar(e: EntradaCotizacion) {
  const noches = e.modalidad === 'NOCHE' ? Math.max(1, e.noches) : 1;
  const tarifa = calcularTarifa(e.tarifas, e.tipo, e.modalidad, e.personas, noches);
  const descuento = Math.min(calcularDescuento(e.modalidad, noches, e.aplicarDescuento, e.descuentoNoche), tarifa);
  const { salida, franja } = calcularSalida(e.modalidad, e.entrada, noches);
  return { tarifa, descuento, total: tarifa - descuento, salida, franja, permitePagoAlSalir: e.modalidad === 'NOCHE' && noches === 1 };
}
