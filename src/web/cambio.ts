// Cambio de habitación (TICKET-26; FR-30, RN-17): qué pasa con la plata, en palabras, a partir de la cotización de la API.
import { pesos, textoSalida } from './logica.ts';

/** Cierra la frase con punto sin duplicarlo (las horas terminan en «m.»). */
const conPunto = (t: string) => (t.endsWith('.') ? t : `${t}.`);

export interface CotizacionCambio {
  tipo: 'SIN_USO' | 'NOCHE_NUEVA'; habitacion_numero: string; diferencia: number; devolucion: number;
  a_favor_pendiente: number; salida_prevista_en: string;
}

export function resumenCambio(c: CotizacionCambio, hoy: string): { titulo: string; valor: number; detalle: string } {
  if (c.tipo === 'NOCHE_NUEVA') {
    return { titulo: `Se cobra la ${c.habitacion_numero} completa`, valor: c.diferencia,
      detalle: conPunto(`Ya usó la habitación: se cobra una noche nueva. Nueva salida: ${textoSalida(c.salida_prevista_en, hoy)}`) };
  }
  const pocos = 'Cambió de opinión a los pocos minutos:';
  if (c.diferencia > 0) return { titulo: 'Paga la diferencia', valor: c.diferencia, detalle: `${pocos} se cobra solo la diferencia. La salida no cambia.` };
  if (c.diferencia === 0) return { titulo: 'Mismo precio', valor: 0, detalle: `${pocos} no cambia lo que paga. La salida no cambia.` };
  const pendiente = c.a_favor_pendiente > 0 ? ` Quedan ${pesos(c.a_favor_pendiente)} a favor por transferencia: la administración decide cómo devolverlos.` : '';
  const efectivo = c.devolucion > 0 ? ' se le devuelve la diferencia en efectivo (sale de la caja).' : ' le queda la diferencia a favor.';
  return { titulo: 'Se le devuelve', valor: -c.diferencia, detalle: `${pocos}${efectivo} La salida no cambia.${pendiente}` };
}

/** Habitaciones a las que se puede pasar: solo las disponibles, sin la actual (FR-02). */
export const disponiblesPara = <T extends { numero: string; estado: string }>(habs: T[], actual: string) =>
  habs.filter((h) => h.estado === 'DISPONIBLE' && h.numero !== actual);
