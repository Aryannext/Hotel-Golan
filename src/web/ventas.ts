// Venta de contado en la PWA (TICKET-22; FR-26, RN-20). Sin JSX, se prueba con node --test.
import { leerPesos, type PagoTurno } from './logica.ts';

/** De dónde viene un cobro: una habitación o una venta de contado (con lo que se vendió). */
export function origenPago(p: Pick<PagoTurno, 'habitacion_numero' | 'venta_detalle'>): string {
  return p.habitacion_numero ? `Habitación ${p.habitacion_numero}` : `Venta de contado · ${p.venta_detalle ?? ''}`;
}

/** Efectivo recibido en una venta de contado: se paga completo (sin abonos); si sobra, son vueltas. */
export function cobroContado(total: number, recibido: string): { puede: boolean; titulo: string; valor: number } {
  const valor = leerPesos(recibido) ?? total;
  if (valor < total) return { puede: false, titulo: 'Falta', valor: total - valor };
  return valor > total ? { puede: true, titulo: 'Vueltas', valor: valor - total } : { puede: true, titulo: 'Pago exacto', valor: 0 };
}
