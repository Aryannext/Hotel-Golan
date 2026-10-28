// Constantes del hotel que usan varios módulos, en un solo lugar (HG-HAL-001 HAL-42). Las habitaciones salen del
// catálogo base, el mismo que usan la semilla y el arranque de una base nueva.
import { HABITACIONES as CATALOGO } from '../../../scripts/lib/catalogo-base.ts';

/** Números de las 12 habitaciones (201 a 211 y 301). */
export const HABITACIONES = CATALOGO.map(([numero]) => numero);

/** Código de PostgreSQL para una clave única repetida. */
export const UNICO_VIOLADO = '23505';
