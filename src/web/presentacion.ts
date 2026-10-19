// Textos e íconos de pantalla según el estado. Sin JSX, se prueba con node --test; deja los componentes sin ternarios anidados.
import type { Habitacion } from './api.ts';
import { TIPOS_DOCUMENTO, diaRelativo, horaBogota, pesos } from './logica.ts';

/** «1 noche», «3 noches». */
export const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function etiquetaCampana(n: number): string {
  return n === 0 ? 'Avisos: no hay pendientes' : `Avisos: ${cuantos(n, 'pendiente', 'pendientes')}`;
}

const ICONO_TONO: Record<string, string> = { alerta: 'alerta', exito: 'check' };
export const icoTono = (tono: string) => ICONO_TONO[tono] ?? 'info';

export function icoMovimiento(l: { valor: number; enCaja: boolean }): string {
  if (l.valor < 0) return 'baja';
  return l.enCaja ? 'efectivo' : 'transferencia';
}

/** Título del recuadro de cambio en efectivo; el abono cambia de texto según la pantalla. */
export function textoCambio(tipo: string, abono: string): string {
  if (tipo === 'vueltas') return 'Vueltas';
  return tipo === 'abono' ? abono : 'Pago exacto';
}

/** Paso `i` (desde 0) del asistente cuando va en el paso `paso` (desde 1). */
export function claseAsistente(paso: number, i: number): string {
  if (paso === i + 1) return 'asistente__paso asistente__paso--activo';
  return paso > i + 1 ? 'asistente__paso asistente__paso--hecho' : 'asistente__paso';
}

const NOTA_FRANJA: Record<string, string> = {
  VEINTICUATRO_HORAS: ' (entró de 6:01 a 9:59 a. m.: 24 horas).',
  MADRUGADA_MISMO_DIA: ' (entró de madrugada: sale hoy al mediodía).',
};
export const notaFranja = (franja: string) => NOTA_FRANJA[franja] ?? '';

export function notaCobro(permitePagoAlSalir: boolean, modalidad: string): string {
  if (permitePagoAlSalir) return 'Una noche se puede cobrar al salir.';
  return modalidad === 'NOCHE' ? 'Varias noches se cobran por adelantado.' : '';
}

/** Segunda línea del cuarto ocupado: cuándo sale y si debe o tiene transferencias por verificar. */
export function detalleCuarto(h: Habitacion, hoy: string): string {
  const e = h.estadia_activa;
  if (!e) return '';
  const sale = `Sale ${diaRelativo(e.salida_prevista_en, hoy)} ${horaBogota(e.salida_prevista_en)}`;
  if (e.saldo) return `${sale} · debe ${pesos(e.saldo)}`;
  return e.por_verificar ? `${sale} · por verificar` : sale;
}

export type AccionCuarto = 'ENTRADA' | 'CUENTA' | 'ESTADO';

/** Disponible: registrar una entrada. Con estadía: su ficha. Por revisar, limpieza o mantenimiento: cambiar su estado. */
export function accionCuarto(h: Habitacion, puede: { elegir: boolean; abrir: boolean; revisar: boolean }): AccionCuarto | null {
  if (h.estado === 'DISPONIBLE') return puede.elegir ? 'ENTRADA' : null;
  if (h.estadia_activa) return puede.abrir ? 'CUENTA' : null;
  return puede.revisar ? 'ESTADO' : null;
}

const PISTA: Record<AccionCuarto, string> = {
  ENTRADA: ', tocar para registrar una entrada', CUENTA: ', tocar para ver la cuenta', ESTADO: ', tocar para cambiar su estado',
};
export const pistaCuarto = (a: AccionCuarto | null) => (a ? PISTA[a] : '');

const TITULO_FICHA: Record<string, string> = {
  devolucion: 'Devolución por desistimiento', extender: 'Extender estadía', cargo: 'Agregar cargos', pago: 'Registrar pago', salida: 'Dar salida',
  lavanderia: 'Recibir lavandería', factura: 'Solicitud de factura', cambio: 'Cambiar de habitación', dano: 'Cobrar un daño',
};
export const tituloFicha = (sub: string, numero: string) => TITULO_FICHA[sub] ?? `Hab. ${numero}`;

/** Etiqueta del estado de un pago; `verificado` cambia según la pantalla («Llegó» o «Verificado»). */
export function pillEstadoPago(estado: string, verificado = 'Verificado'): [string, string] | null {
  if (estado === 'POR_VERIFICAR') return ['pill--aviso', 'Por verificar'];
  if (estado === 'RECHAZADO') return ['pill--alerta', 'No llegó'];
  return estado === 'VERIFICADO' ? ['pill--exito', verificado] : null;
}

export function textoDevolucion(valor: number, medio: 'EFECTIVO' | 'TRANSFERENCIA'): string {
  if (!valor) return 'La estadía se cierra y la habitación pasa a revisión.';
  return medio === 'EFECTIVO' ? 'Sale de la caja del turno; no cuenta como venta.' : 'La administración hace la transferencia.';
}

export function textoDesistimiento(numero: string, r: { valor: number; medio: string | null }): string {
  if (!r.valor) return `Desistimiento registrado en la ${numero}, sin devolución. La habitación queda por revisar.`;
  const desde = r.medio === 'EFECTIVO' ? 'de la caja' : 'por transferencia';
  return `Desistimiento registrado en la ${numero}: se devolvieron ${pesos(r.valor)} ${desde}. La habitación queda por revisar.`;
}

/** FR-31 (V5-02): el documento completo, para que la policía lo valide; o «Sin documento» (es opcional, RN-16). */
/** «PASAPORTE» → «Pasaporte», «CC» → «Cédula»; un código desconocido se muestra tal cual. */
export const nombreTipoDocumento = (tipo: string) => TIPOS_DOCUMENTO.find(([v]) => v === tipo)?.[1] ?? tipo;

export const textoDocumento = (t: { tipo_documento: string | null; numero_documento: string | null }) =>
  t.numero_documento ? `${t.tipo_documento ? nombreTipoDocumento(t.tipo_documento) : ''} ${t.numero_documento}`.trim() : 'Sin documento';

/** Los avisos del inicio, en una sola línea: «1 cosa por atender», «3 cosas por atender». */
export const textoPendientes = (n: number) => `${n} ${n === 1 ? 'cosa' : 'cosas'} por atender`;
