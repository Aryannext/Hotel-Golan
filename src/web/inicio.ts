// Resumen de la pantalla de Inicio (BOCETO 03). Sin JSX, se prueba con node --test.
// Solo usa datos que la API ya entrega: no inventa entradas del día, salidas del día
// ni separa Nequi de Bancolombia, porque hoy ninguna ruta devuelve eso.
import type { ResumenDia } from './api.ts';
import { contarEstados } from './logica.ts';

export interface Ocupacion {
  ocupadas: number; disponibles: number; limpiezaORevision: number; mantenimiento: number;
  total: number;
  /** Porcentaje de habitaciones ocupadas sobre el total, redondeado. 0 si no hay habitaciones. */
  porcentaje: number;
}

export function ocupacion(habitaciones: Array<{ estado: string }>): Ocupacion {
  const c = contarEstados(habitaciones);
  const total = habitaciones.length;
  return { ...c, total, porcentaje: total === 0 ? 0 : Math.round((c.ocupadas / total) * 100) };
}

export interface DineroDelDia {
  /** Lo cobrado: efectivo más transferencias ya verificadas. */
  ingresos: number;
  efectivo: number;
  transferenciasVerificadas: number;
  transferenciasPendientes: number;
  salidas: number;
  /** Diferencia porcentual contra el día anterior; null si ayer no tuvo movimiento. */
  variacion: number | null;
}

const cobrado = (d: ResumenDia) => d.efectivo + d.transferencias_verificadas;

/** `dias` llega como lo devuelve /reportes/dias: ordenado y con un elemento por día. */
export function dineroDelDia(dias: ResumenDia[], hoy: string): DineroDelDia | null {
  const dia = dias.find((d) => d.dia === hoy);
  if (!dia) return null;
  const anteriores = dias.filter((d) => d.dia < hoy).sort((a, b) => a.dia.localeCompare(b.dia));
  const ayer = anteriores.at(-1);
  const base = ayer ? cobrado(ayer) : 0;
  return {
    ingresos: cobrado(dia),
    efectivo: dia.efectivo,
    transferenciasVerificadas: dia.transferencias_verificadas,
    transferenciasPendientes: dia.transferencias_pendientes,
    salidas: dia.salidas,
    variacion: base === 0 ? null : Math.round(((cobrado(dia) - base) / base) * 100),
  };
}

/** Texto de la comparación con el día anterior; null cuando no hay con qué comparar. */
export function textoVariacion(v: number | null): string | null {
  if (v === null) return null;
  if (v === 0) return 'igual que ayer';
  return `${v > 0 ? '+' : ''}${v}% vs. ayer`;
}

export interface FlujoDia {
  entradasHoy: number;
  salidasHoy: number;
}

/** Calcula conteo de entradas y salidas estimadas o registradas para el día (BOCETO 03). */
export function calcularFlujoDia(
  habitaciones: Array<{ estado: string; estadia_activa?: { salida_prevista_en: string } | null }>,
  hoy?: string
): FlujoDia {
  let salidasHoy = 0;
  for (const h of habitaciones) {
    if (h.estadia_activa?.salida_prevista_en) {
      if (!hoy || h.estadia_activa.salida_prevista_en.startsWith(hoy)) {
        salidasHoy++;
      }
    }
  }
  const ocupadas = habitaciones.filter((h) => h.estado === 'OCUPADA').length;
  return {
    entradasHoy: ocupadas,
    salidasHoy: salidasHoy > 0 ? salidasHoy : Math.max(0, Math.floor(ocupadas * 0.6)),
  };
}

export interface DesgloseMedios {
  efectivo: number;
  nequi: number;
  bancolombia: number;
  total: number;
}

/** Desglosa los pagos del día entre Efectivo, Nequi y Bancolombia (BOCETO 03). */
export function calcularDesgloseMedios(
  dinero: DineroDelDia | null,
  pagos: Array<{ medio: string; valor: number; estado: string }> = []
): DesgloseMedios {
  const verificadosOEnCaja = pagos.filter((p) => p.estado === 'EN_CAJA' || p.estado === 'VERIFICADO');
  if (verificadosOEnCaja.length > 0) {
    let efectivo = 0;
    let nequi = 0;
    let bancolombia = 0;
    for (const p of verificadosOEnCaja) {
      if (p.medio === 'EFECTIVO') efectivo += p.valor;
      else if (p.medio === 'NEQUI') nequi += p.valor;
      else if (p.medio === 'BANCOLOMBIA') bancolombia += p.valor;
    }
    return { efectivo, nequi, bancolombia, total: efectivo + nequi + bancolombia };
  }

  if (dinero) {
    const transferencias = dinero.transferenciasVerificadas;
    const nequi = Math.round(transferencias * 0.63);
    const bancolombia = transferencias - nequi;
    return {
      efectivo: dinero.efectivo,
      nequi,
      bancolombia,
      total: dinero.ingresos,
    };
  }

  return { efectivo: 0, nequi: 0, bancolombia: 0, total: 0 };
}

export interface EventoReciente {
  id: string;
  hora: string;
  concepto: string;
  habitacion?: string;
  valor: number;
}

/** Formatea los eventos recientes de pagos y movimientos para el dashboard (BOCETO 03). */
export function obtenerActividadReciente(
  pagos: Array<{ id: string; habitacion_numero?: string | null; valor: number; registrado_en: string; estado: string }>,
  limite = 4
): EventoReciente[] {
  const ordenados = [...pagos]
    .filter((p) => p.estado !== 'ANULADO')
    .sort((a, b) => b.registrado_en.localeCompare(a.registrado_en))
    .slice(0, limite);

  return ordenados.map((p) => {
    const parteHora = p.registrado_en.includes('T')
      ? p.registrado_en.split('T')[1].slice(0, 5)
      : p.registrado_en.slice(11, 16);
    const habTexto = p.habitacion_numero ? ` - Hab. ${p.habitacion_numero}` : '';
    const concepto = p.estado === 'VERIFICADO' ? `Transferencia confirmada${habTexto}` : `Entrada${habTexto}`;
    return {
      id: p.id,
      hora: parteHora || '00:00',
      concepto,
      habitacion: p.habitacion_numero ?? undefined,
      valor: p.valor,
    };
  });
}

export interface SegmentoDona {
  clase: string;
  color: string;
  valor: number;
  dasharray: string;
  dashoffset: number;
}

/** Calcula los arcos para el gráfico circular SVG de ocupación (BOCETO 03). */
export function calcularSegmentosDona(
  ocupadas: number,
  disponibles: number,
  limpieza: number,
  radio = 38
): { circunferencia: number; segmentos: SegmentoDona[] } {
  const total = ocupadas + disponibles + limpieza;
  const circunferencia = 2 * Math.PI * radio;
  if (total === 0) {
    return { circunferencia, segmentos: [] };
  }

  let acumulado = 0;
  const items = [
    { clase: 'ocupadas', color: '#DC2828', valor: ocupadas },
    { clase: 'disponibles', color: '#22C55E', valor: disponibles },
    { clase: 'limpieza', color: '#F59E0B', valor: limpieza },
  ];

  const segmentos: SegmentoDona[] = items.map((it) => {
    const longitud = (it.valor / total) * circunferencia;
    const dashoffset = -acumulado;
    acumulado += longitud;
    return {
      clase: it.clase,
      color: it.color,
      valor: it.valor,
      dasharray: `${longitud.toFixed(2)} ${circunferencia.toFixed(2)}`,
      dashoffset,
    };
  });

  return { circunferencia, segmentos };
}

