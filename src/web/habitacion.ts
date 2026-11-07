// Datos de una habitación y su estadía para el panel de detalles y la pantalla de
// la cuenta (BOCETO 04 y 05). Sin JSX, se prueba con node --test.
//
// El boceto muestra foto, teléfono y número de reserva: nada de eso existe en el
// sistema, así que no aparece aquí. Lo que sí existe se arma abajo, y lo que no se
// puede saber todavía se devuelve como null para que la pantalla ponga un guion.
import type { Cargo, Estadia } from './api.ts';

const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];

/** Franja visual de llegada, independiente de la modalidad cobrada y del reloj del dispositivo. */
export function franjaEntrada(iso: string): 'dia' | 'noche' | null {
  const fecha = new Date(iso);
  if (!Number.isFinite(fecha.getTime())) return null;
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hourCycle: 'h23' }).format(fecha));
  return hora >= 6 && hora < 18 ? 'dia' : 'noche';
}

/** «15 oct. 2026» a partir de un ISO que ya viene en hora de Bogotá. */
export function fechaLarga(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`;
}

/** Una fila de «Información» del panel: etiqueta, valor y un ícono para reconocerla. */
export interface DatoHabitacion {
  etiqueta: string;
  valor: string;
  ico: string;
}

/** Los cargos de alojamiento son los que pagan la noche; los demás son consumos. */
export const esAlojamiento = (c: Cargo) => c.tipo === 'ALOJAMIENTO';

/**
 * Lo que cuesta una noche, sacado de los cargos de alojamiento no anulados.
 * Devuelve null si todavía no hay ninguno: la tarifa no se adivina.
 */
export function tarifaNoche(cargos: Cargo[]): number | null {
  const alojamiento = cargos.filter((c) => esAlojamiento(c) && !c.anulado);
  if (alojamiento.length === 0) return null;
  // Todas las noches de una estadía se cobran al mismo valor unitario.
  return alojamiento[0].valor_unitario;
}

/** Cargos que no son alojamiento: la nevera, la llave, el aseo, la lavandería. */
export const consumos = (cargos: Cargo[]) => cargos.filter((c) => !esAlojamiento(c));

/** Suma de lo no anulado; es lo que de verdad se debe. */
export const totalVigente = (cargos: Cargo[]) =>
  cargos.filter((c) => !c.anulado).reduce((s, c) => s + c.valor, 0);

/**
 * Las filas de «Información» del panel de detalles, en el orden del boceto.
 * `fecha` y `hora` las pone quien llama, que es quien sabe de husos horarios.
 */
export function datosEstadia(
  e: Estadia,
  fmt: { fecha: (iso: string) => string; hora: (iso: string) => string; pesos: (n: number) => string },
): DatoHabitacion[] {
  const tarifa = tarifaNoche(e.cargos);
  return [
    { etiqueta: 'Huésped actual', valor: e.huesped.nombre_mostrado, ico: 'huespedes' },
    { etiqueta: 'Personas', valor: String(e.personas), ico: 'usuarios' },
    { etiqueta: 'Entrada', valor: `${fmt.fecha(e.entrada_en)} · ${fmt.hora(e.entrada_en)}`, ico: 'calendario' },
    { etiqueta: 'Salida prevista', valor: `${fmt.fecha(e.salida_prevista_en)} · ${fmt.hora(e.salida_prevista_en)}`, ico: 'calendario' },
    { etiqueta: 'Noches', valor: String(e.noches), ico: 'reloj' },
    { etiqueta: 'Tarifa por noche', valor: tarifa === null ? '—' : fmt.pesos(tarifa), ico: 'efectivo' },
    { etiqueta: 'Total de cargos', valor: fmt.pesos(e.cuenta.total_cargos), ico: 'tarjeta-pago' },
  ];
}

/** Cómo se lee el saldo: a favor, al día o pendiente. */
export function textoSaldo(cuenta: Estadia['cuenta']): { texto: string; tono: 'exito' | 'alerta' | 'neutro' } {
  if (cuenta.saldo > 0) return { texto: 'Saldo pendiente', tono: 'alerta' };
  if (cuenta.a_favor > 0) return { texto: 'Queda a favor', tono: 'exito' };
  return { texto: 'Cuenta al día', tono: 'neutro' };
}

/** Solo se puede dar salida con la cuenta en cero (RN-09); si no, se dice por qué. */
export function porQueNoSale(cuenta: Estadia['cuenta'], pesos: (n: number) => string): string | null {
  if (cuenta.saldo > 0) return `Falta cobrar ${pesos(cuenta.saldo)} para poder dar la salida.`;
  if (cuenta.por_verificar > 0) return `Hay ${pesos(cuenta.por_verificar)} en transferencias sin confirmar.`;
  return null;
}
