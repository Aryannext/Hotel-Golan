// Lavandería en la PWA (TICKET-23; FR-27, RN-22). Sin JSX, se prueba con node --test.
import { pesos } from './logica.ts';

export interface PedidoLavanderia {
  id: string; estadia_id: string | null; habitacion_numero: string | null; cliente_nombre: string | null; detalle: string; total: number; estado: string;
  /** Solo externos: lo que falta pagar del pedido (TICKET-24). */
  por_cobrar: number | null;
  registrado_por: string; registrado_en: string; entregado_por: string | null; entregado_en: string | null; sin_pago_autorizado_por: string | null;
}

/** Lo que falta por pagar del pedido: su valor, sin pasar del saldo de la cuenta (si pagó antes, no se cobra de nuevo). */
export const faltaDelPedido = (total: number, saldo: number) => Math.min(total, Math.max(0, saldo));

/** Lo que falta para entregar: un externo, lo que debe el pedido; un huésped, según el saldo de su cuenta (null mientras se consulta). */
export function faltaParaEntregar(p: Pick<PedidoLavanderia, 'estadia_id' | 'total' | 'por_cobrar'>, saldoCuenta: number | null): number | null {
  if (!p.estadia_id) return p.por_cobrar ?? 0;
  return saldoCuenta === null ? null : faltaDelPedido(p.total, saldoCuenta);
}

export const quienPidio = (p: Pick<PedidoLavanderia, 'habitacion_numero' | 'cliente_nombre'>) =>
  (p.habitacion_numero ? `Hab. ${p.habitacion_numero}` : p.cliente_nombre ?? '');

export function textoEntrega(quien: string, como: 'cobrado' | 'pagado' | 'sin_pago', valor: number): string {
  if (como === 'cobrado') return `Ropa entregada a ${quien}. Se cobraron ${pesos(valor)}.`;
  if (como === 'pagado') return `Ropa entregada a ${quien}. Ya estaba pagada.`;
  return `Ropa entregada a ${quien} sin pago: quedan ${pesos(valor)} por cobrar y queda registrado que usted lo autorizó.`;
}
