// Cobrar un daño (TICKET-27; RN-18): el valor de reposición «como nuevo» lo pone solo la administración (V5-06).
import { leerPesos } from './logica.ts';

export const AVISO_DANO_RECEPCION = 'Si el huésped dañó algo, llame a la administradora: ella pone el valor y lo carga a la cuenta.';

export function leerDano(descripcion: string, valor: string): { ok: true; descripcion: string; valor: number } | { ok: false; error: string } {
  const d = descripcion.trim();
  if (d.length < 3) return { ok: false, error: 'Escriba qué se dañó (por ejemplo, «Vaso roto»).' };
  const v = leerPesos(valor);
  if (!v || v < 1) return { ok: false, error: 'Escriba cuánto cuesta reponerlo, como nuevo.' };
  return { ok: true, descripcion: d, valor: v };
}
