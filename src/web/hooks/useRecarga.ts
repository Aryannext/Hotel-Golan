// Cuándo hay que volver a pedirle el estado al servidor. Los eventos en vivo (SSE,
// ADR-005) y la consulta de respaldo cada 30 s suben un contador; las pantallas lo
// reciben como `recarga` y vuelven a cargar solas. Aparte de eso, los eventos de
// transferencias avisan en pantalla, y a quién le interesa cuál depende del rol.
import { useState } from 'preact/hooks';
import { useEnVivo } from '../enVivo.ts';
import { avisoEvento } from '../logica.ts';
import type { Aviso } from './useAviso.ts';

/** Eventos que a la administración le importan; a recepción le importa el resto. */
const DE_ADMINISTRACION = ['pago.por_verificar', 'turno.diferencia'];

export interface Recarga {
  /** Sube de uno en uno; las pantallas lo leen como «vuelva a cargar». */
  recarga: number;
  recargar: () => void;
}

export function useRecarga(activo: boolean, esAdmin: boolean, avisar: (a: Aviso) => void): Recarga {
  const [recarga, setRecarga] = useState(0);

  useEnVivo(activo, (ev) => {
    setRecarga((n) => n + 1);
    const a = ev && avisoEvento(ev);
    if (a && (esAdmin ? DE_ADMINISTRACION.includes(ev.tipo) : ev.tipo !== 'pago.por_verificar')) avisar(a);
  });

  return { recarga, recargar: () => setRecarga((n) => n + 1) };
}
