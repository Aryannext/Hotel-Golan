// Avisos en pantalla (TICKET-16, FR-23, RN-04). Se calculan en la PWA con GET /habitaciones y GET /reglas:
// el vencimiento se compara con la hora actual, así que una salida vencida aparece sin recargar.
// Solo número de habitación y valores: nunca el nombre del huésped.
import type { Habitacion } from './api.ts';
import { pesos } from './logica.ts';
import { textoHora, type Reglas } from './ajustes.ts';

export type TipoAviso = 'VENCIDA' | 'MIGRACION' | 'POR_VERIFICAR' | 'POR_REVISAR' | 'LIMPIEZA' | 'EXISTENCIAS';
export interface Aviso { clave: string; tipo: TipoAviso; tono: 'alerta' | 'aviso' | 'info'; habitacion: string; titulo: string; detalle: string; estadiaId?: string; reporte?: TipoReporte }

const ORDEN: Record<TipoAviso, number> = { VENCIDA: 0, MIGRACION: 1, POR_VERIFICAR: 2, POR_REVISAR: 3, LIMPIEZA: 4, EXISTENCIAS: 5 };

/** Un reporte a Migración pendiente (GET /migracion/pendientes, TICKET-37). Sin datos del huésped. */
export type TipoReporte = 'LLEGADA' | 'SALIDA';
export interface PendienteMigracion { estadia_id: string; habitacion_numero: string; tipo: TipoReporte; desde: string; atrasado: boolean }

/** Existencias de un producto de nevera o vitrina (GET /existencias, TICKET-21). */
export interface Existencia { producto_id: string; nombre: string; grupo: string; surtido: number; vendido: number; existencias: number }

/** «1 h 20 min», «5 min», «2 h», «menos de 1 min»; desde un día, «3 días y 8 h» (sin minutos). */
export function haceCuanto(desde: number, ahora: number): string {
  const min = Math.floor((ahora - desde) / 60_000);
  if (min < 1) return 'menos de 1 min';
  if (min >= 24 * 60) {
    const dias = Math.floor(min / (24 * 60));
    const horas = Math.floor((min % (24 * 60)) / 60);
    const texto = `${dias} día${dias === 1 ? '' : 's'}`;
    return horas ? `${texto} y ${horas} h` : texto;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function detalleVencida(reglas: Pick<Reglas, 'valor_hora' | 'hora_noche_completa'> | null): string {
  if (!reglas) return 'Extienda o dé salida.';
  return `Corre ${pesos(reglas.valor_hora)} por hora. Desde las ${textoHora(reglas.hora_noche_completa)} se cobra la noche completa. Extienda o dé salida.`;
}

function avisosDe(h: Habitacion, reglas: Pick<Reglas, 'valor_hora' | 'hora_noche_completa'> | null, ahora: number): Aviso[] {
  const avisos: Aviso[] = [];
  const e = h.estadia_activa;
  if (e) {
    const salida = Date.parse(e.salida_prevista_en);
    if (ahora > salida) {
      avisos.push({ clave: `vencida-${h.numero}`, tipo: 'VENCIDA', tono: 'alerta', habitacion: h.numero,
        titulo: `Hab. ${h.numero}: la salida venció hace ${haceCuanto(salida, ahora)}`, detalle: detalleVencida(reglas) });
    }
    if (e.por_verificar > 0) {
      avisos.push({ clave: `verificar-${h.numero}`, tipo: 'POR_VERIFICAR', tono: 'aviso', habitacion: h.numero,
        titulo: `Hab. ${h.numero}: transferencia por verificar de ${pesos(e.por_verificar)}`, detalle: 'La administración debe confirmar si llegó.' });
    }
  }
  if (h.estado === 'POR_REVISAR') {
    avisos.push({ clave: `revisar-${h.numero}`, tipo: 'POR_REVISAR', tono: 'info', habitacion: h.numero,
      titulo: `Hab. ${h.numero}: por revisar`, detalle: h.nota ?? 'Revise cómo quedó antes de volver a ocuparla.' });
  }
  if (h.estado === 'LIMPIEZA') {
    avisos.push({ clave: `limpieza-${h.numero}`, tipo: 'LIMPIEZA', tono: 'info', habitacion: h.numero,
      titulo: `Hab. ${h.numero}: en limpieza`, detalle: h.nota ?? 'Cuando quede lista, márquela como disponible.' });
  }
  return avisos;
}

/** Habitaciones primero (vencidas, por verificar, por revisar, limpieza); después, productos. */
export function ordenarAvisos(avisos: Aviso[]): Aviso[] {
  return [...avisos].sort((a, b) => ORDEN[a.tipo] - ORDEN[b.tipo] || a.habitacion.localeCompare(b.habitacion) || a.clave.localeCompare(b.clave));
}

export function calcularAvisos(habitaciones: Habitacion[], reglas: Pick<Reglas, 'valor_hora' | 'hora_noche_completa'> | null, ahora: number): Aviso[] {
  return ordenarAvisos(habitaciones.flatMap((h) => avisosDe(h, reglas, ahora)));
}

/**
 * RN-21: productos que ya se surtieron alguna vez y quedan en 0 o menos. Lo que nunca se ha surtido no avisa,
 * para que al empezar (todo en 0) la campana no se llene. Solo para la administración.
 */
export function avisosExistencias(existencias: Existencia[]): Aviso[] {
  return existencias.filter((x) => x.surtido > 0 && x.existencias <= 0).map((x) => {
    const falta = -x.existencias;
    const cuantas = falta === 1 ? 'falta 1' : `faltan ${falta}`;
    return x.existencias === 0
      ? { clave: `existencias-${x.producto_id}`, tipo: 'EXISTENCIAS' as const, tono: 'aviso' as const, habitacion: '',
        titulo: `${x.nombre}: se acabó`, detalle: 'Según lo que llegó y lo vendido no queda ninguno. Revise y anote lo que llegue.' }
      : { clave: `existencias-${x.producto_id}`, tipo: 'EXISTENCIAS' as const, tono: 'alerta' as const, habitacion: '',
        titulo: `${x.nombre}: ${cuantas}`, detalle: 'Se vendió más de lo que se anotó como llegado. Revise la vitrina o la nevera.' };
  });
}

/**
 * FR-33 (TICKET-37): los huéspedes extranjeros se reportan a Migración Colombia al llegar y al salir (RN-24).
 * El sistema no se conecta al SIRE: recuerda el reporte hasta que recepción marque «Ya lo reporté».
 */
export function avisosMigracion(pendientes: PendienteMigracion[]): Aviso[] {
  return pendientes.map((p) => ({
    clave: `migracion-${p.estadia_id}-${p.tipo}`, tipo: 'MIGRACION' as const, tono: p.atrasado ? 'alerta' as const : 'aviso' as const,
    habitacion: p.habitacion_numero, estadiaId: p.estadia_id, reporte: p.tipo,
    titulo: `Hab. ${p.habitacion_numero}: reportar a Migración la ${p.tipo === 'LLEGADA' ? 'llegada' : 'salida'}${p.atrasado ? ' (atrasado)' : ''}`,
    detalle: 'Es un huésped extranjero. Repórtelo en la página de Migración Colombia (SIRE) y marque «Ya lo reporté».',
  }));
}
