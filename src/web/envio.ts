// Enviar una operación y releer la pantalla (HG-HAL-001 HAL-09): si la operación ya quedó, un fallo al releer no se
// muestra como «No se pudo conectar», porque eso invita a repetir un cobro que sí se hizo.
import { ErrorApi } from './api.ts';

// «No se duplicará» es cierto porque cada operación lleva su Idempotency-Key (HAL-08).
export const SIN_CONEXION = 'No se pudo conectar con el sistema. Intente de nuevo: no se duplicará.';
export const GUARDADO_SIN_ACTUALIZAR = 'Quedó guardado, pero no se pudo actualizar la pantalla. No lo repita: cierre y vuelva a abrir para ver cómo quedó.';

/** El mensaje de la API en palabras; cualquier otro error (sin señal, «Failed to fetch») es falta de conexión. */
export const mensajeDeError = (e: unknown) => (e instanceof ErrorApi ? e.message : SIN_CONEXION);

export type ResultadoEnvio<T> = { hecho: false; error: string } | { hecho: true; resultado: T; aviso: string };

/** Ejecuta `accion` y, solo si quedó, `releer`. Los dos fallos se distinguen: el segundo no deshace lo hecho. */
export async function enviarYReleer<T>(accion: () => Promise<T>, releer: () => Promise<void>): Promise<ResultadoEnvio<T>> {
  let resultado: T;
  try {
    resultado = await accion();
  } catch (e) {
    return { hecho: false, error: mensajeDeError(e) };
  }
  try {
    await releer();
    return { hecho: true, resultado, aviso: '' };
  } catch {
    return { hecho: true, resultado, aviso: GUARDADO_SIN_ACTUALIZAR };
  }
}
