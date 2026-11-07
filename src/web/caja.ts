// Lo que se muestra de la caja por turno (BOCETO 06). Sin JSX, se prueba con node --test.
// Cada cifra viene de /turnos/actual o de /turnos. Lo que solo existe al entregar el
// turno —el conteo y la diferencia— se devuelve como null y la pantalla pone un guion:
// un turno abierto todavía no tiene esas cifras y suponerlas sería inventarlas.
import type { Turno } from './api.ts';
import { horaBogota } from './logica.ts';

/** «7:00 a. m. – 3:00 p. m.»: del inicio al fin, o al fin programado si sigue abierto. */
export function horarioTurno(t: Turno): string {
  return `${horaBogota(t.inicio_en)} – ${horaBogota(t.fin_en ?? t.fin_programado_en)}`;
}

/** Una línea del resumen del turno. `valor` en null significa «todavía no se sabe». */
export interface LineaCaja {
  etiqueta: string;
  valor: number | null;
  /** Para destacar el esperado y pintar la diferencia según su signo. */
  tono?: 'destacado' | 'positivo' | 'negativo';
}

/** El estado del turno en una palabra, como lo muestra el boceto. */
export function estadoTurno(t: Turno): 'En curso' | 'Cerrado' | 'Por recibir' {
  if (t.estado === 'CERRADO') return 'Cerrado';
  if (t.estado === 'POR_RECIBIR') return 'Por recibir';
  return 'En curso';
}

/** Tono de una diferencia: sobra, falta o cuadra exacto. */
export function tonoDiferencia(diferencia: number): LineaCaja['tono'] {
  if (diferencia === 0) return undefined;
  return diferencia > 0 ? 'positivo' : 'negativo';
}

/**
 * Las líneas del turno en el orden del boceto. Mientras el turno está abierto, el
 * conteo y la diferencia van en null porque se registran al entregarlo.
 */
export function lineasCaja(t: Turno): LineaCaja[] {
  const c = t.caja;
  const cierre = t.cierre;
  return [
    { etiqueta: 'Base recibida', valor: c.base_recibida },
    { etiqueta: 'Ingresos en efectivo', valor: c.efectivo },
    { etiqueta: 'Egresos en efectivo', valor: c.salidas },
    { etiqueta: 'Efectivo esperado', valor: cierre ? cierre.efectivo_esperado : c.debe_haber, tono: 'destacado' },
    { etiqueta: 'Efectivo contado', valor: cierre ? cierre.efectivo_contado : null },
    { etiqueta: 'Pago del turno', valor: c.pago_turno },
    { etiqueta: 'Diferencia', valor: cierre ? cierre.diferencia : null, tono: cierre ? tonoDiferencia(cierre.diferencia) : undefined },
  ];
}

/** Una fila del historial de turnos (solo administración: /turnos pide ese rol). */
export interface FilaTurno {
  id: string;
  tipo: 'DIA' | 'NOCHE';
  inicio: string;
  responsable: string;
  baseRecibida: number;
  ingresos: number;
  egresos: number;
  esperado: number;
  contado: number | null;
  diferencia: number | null;
  estado: ReturnType<typeof estadoTurno>;
}

export function filaTurno(t: Turno): FilaTurno {
  return {
    id: t.id,
    tipo: t.tipo,
    inicio: t.inicio_en,
    // Un turno por recibir todavía no tiene a nadie a cargo.
    responsable: t.responsable ?? '—',
    baseRecibida: t.base_recibida ?? t.caja.base_recibida,
    ingresos: t.caja.efectivo,
    egresos: t.caja.salidas,
    esperado: t.cierre ? t.cierre.efectivo_esperado : t.caja.debe_haber,
    contado: t.cierre ? t.cierre.efectivo_contado : null,
    diferencia: t.cierre ? t.cierre.diferencia : null,
    estado: estadoTurno(t),
  };
}

/**
 * El último turno de cada tipo, para las dos tarjetas de la derecha del boceto.
 * Se queda con el más reciente de cada uno; si de alguno no hay ninguno, va null.
 */
export function ultimoDeCadaTipo(turnos: Turno[]): { dia: Turno | null; noche: Turno | null } {
  const masReciente = (tipo: 'DIA' | 'NOCHE') =>
    turnos.filter((t) => t.tipo === tipo).sort((a, b) => b.inicio_en.localeCompare(a.inicio_en))[0] ?? null;
  return { dia: masReciente('DIA'), noche: masReciente('NOCHE') };
}
