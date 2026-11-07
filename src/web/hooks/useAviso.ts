// El aviso de una línea que sale sobre la vista: «Entrada registrada en la
// habitación 203…». Es un solo estado, pero lo usan casi todas las pantallas y
// tenerlo aparte evita que cada una tenga que saber cómo se guarda.
import { useState } from 'preact/hooks';

export interface Aviso { tono: 'exito' | 'alerta' | 'info'; texto: string }

export interface Avisador {
  aviso: Aviso | null;
  mostrar: (a: Aviso) => void;
  /** Atajo para el caso más común: algo salió bien. */
  exito: (texto: string) => void;
  limpiar: () => void;
}

export function useAviso(): Avisador {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  return {
    aviso,
    mostrar: setAviso,
    exito: (texto) => setAviso({ tono: 'exito', texto }),
    limpiar: () => setAviso(null),
  };
}
