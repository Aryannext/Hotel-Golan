// Resumen de la pantalla de Inicio (BOCETO 03). Sin JSX, se prueba con node --test.
// Cada cifra sale de una ruta de la API: las entradas y salidas del día, de las
// estadías activas; el dinero, del informe de días. Lo que la API no distingue
// —Nequi frente a Bancolombia sin los pagos del turno— se deja sin separar en vez
// de repartirlo: una cifra estimada se lee en pantalla igual que una real.
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
  salidasPrevistasHoy: number;
}

/** Lo que se necesita de cada estadía activa; lo entrega GET /huespedes/hoy. */
export interface EstadiaDelDia { entrada_en: string; salida_prevista_en: string }

/**
 * Entradas y salidas del día contadas sobre las estadías activas, que traen la hora
 * real de entrada y la salida prevista en hora de Bogotá («2026-10-26T14:30:00-05:00»).
 *
 * «Entradas de hoy» cuenta las que empezaron hoy y siguen abiertas: si alguien entró
 * y salió el mismo día (modalidad de tres horas) no aparece, porque ninguna ruta de
 * la API devuelve hoy las estadías ya cerradas. Se prefiere quedarse corto antes que
 * estimar: en pantalla, un número estimado se lee igual que uno real.
 */
export function calcularFlujoDia(estadias: EstadiaDelDia[], hoy: string): FlujoDia {
  let entradasHoy = 0;
  let salidasPrevistasHoy = 0;
  for (const e of estadias) {
    if (e.entrada_en.startsWith(hoy)) entradasHoy++;
    if (e.salida_prevista_en.startsWith(hoy)) salidasPrevistasHoy++;
  }
  return { entradasHoy, salidasPrevistasHoy };
}

export interface DesgloseMedios {
  efectivo: number;
  nequi: number;
  bancolombia: number;
  /** Transferencias sin separar; es lo único que se sabe cuando no hay pagos detallados. */
  transferencias: number;
  total: number;
  /** true solo si Nequi y Bancolombia salen de pagos reales, no de un reparto. */
  detallado: boolean;
}

/**
 * Desglosa los pagos del día (BOCETO 03). Con los pagos del turno a la vista se
 * separa cada medio sumándolos uno por uno. Sin ellos solo queda el informe del
 * día, que trae el efectivo y las transferencias juntas: ahí `detallado` va en
 * false y Nequi y Bancolombia quedan en cero, porque repartir ese total entre los
 * dos sería inventarlo.
 */
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
    return {
      efectivo, nequi, bancolombia,
      transferencias: nequi + bancolombia,
      total: efectivo + nequi + bancolombia,
      detallado: true,
    };
  }

  if (dinero) {
    return {
      efectivo: dinero.efectivo,
      nequi: 0,
      bancolombia: 0,
      transferencias: dinero.transferenciasVerificadas,
      total: dinero.ingresos,
      detallado: false,
    };
  }

  return { efectivo: 0, nequi: 0, bancolombia: 0, transferencias: 0, total: 0, detallado: false };
}

export interface PuntoIngreso { dia: string; valor: number }

/** Lo cobrado por día, en orden, para el gráfico de ingresos. */
export function serieIngresos(dias: ResumenDia[], hasta: string, cuantos = 7): PuntoIngreso[] {
  return dias
    .filter((d) => d.dia <= hasta)
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .slice(-cuantos)
    .map((d) => ({ dia: d.dia, valor: cobrado(d) }));
}

/**
 * Trazo SVG de la serie de ingresos sobre un lienzo de `ancho`×`alto`. Devuelve null
 * con menos de dos días: una línea necesita dos puntos, y antes se dibujaba una onda
 * fija que subía siempre, hubiera o no ingresos.
 */
export function trazoIngresos(serie: PuntoIngreso[], ancho = 280, alto = 65): string | null {
  if (serie.length < 2) return null;
  const maximo = Math.max(...serie.map((p) => p.valor));
  const paso = ancho / (serie.length - 1);
  const y = (valor: number) => (maximo === 0 ? alto - 4 : alto - 4 - (valor / maximo) * (alto - 10));
  return serie
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(i * paso)} ${Math.round(y(p.valor))}`)
    .join(' ');
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

