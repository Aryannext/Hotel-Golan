// Qué hay abierto encima de la vista: el asistente de entrada, la ficha de una
// habitación, el panel para revisarla o limpiarla, «quiénes se quedan hoy» y el
// reporte a Migración. Son cinco estados que siempre se mueven juntos, y tenerlos
// aquí evita que al cerrar sesión o al cambiar de vista se olvide cerrar alguno.
import { useState } from 'preact/hooks';
import type { Habitacion } from '../api.ts';
import type { Aviso as AvisoPendiente } from '../avisos.ts';

export interface Paneles {
  /** Habitación en el asistente de entrada; se muestra en el panel contextual, sin reemplazar la vista. */
  cotizando: Habitacion | null;
  ficha: Habitacion | null;
  fichaInicio: 'cuenta' | 'salida' | 'extender';
  revisando: Habitacion | null;
  viendoHoy: boolean;
  reportando: AvisoPendiente | null;
  cotizar: (h: Habitacion | null) => void;
  abrirFicha: (h: Habitacion | null, inicio?: 'cuenta' | 'salida' | 'extender') => void;
  revisar: (h: Habitacion | null) => void;
  verHoy: (abierto: boolean) => void;
  reportar: (a: AvisoPendiente | null) => void;
  cerrarTodo: () => void;
}

export function usePaneles(): Paneles {
  const [cotizando, setCotizando] = useState<Habitacion | null>(null);
  const [ficha, setFicha] = useState<Habitacion | null>(null);
  const [fichaInicio, setFichaInicio] = useState<'cuenta' | 'salida' | 'extender'>('cuenta');
  const [revisando, setRevisando] = useState<Habitacion | null>(null);
  const [viendoHoy, setViendoHoy] = useState(false);
  const [reportando, setReportando] = useState<AvisoPendiente | null>(null);

  return {
    cotizando, ficha, fichaInicio, revisando, viendoHoy, reportando,
    cotizar: setCotizando,
    abrirFicha: (h, inicio = 'cuenta') => { setFichaInicio(inicio); setFicha(h); },
    revisar: setRevisando,
    verHoy: setViendoHoy,
    reportar: setReportando,
    cerrarTodo: () => {
      setCotizando(null);
      setFicha(null);
      setRevisando(null);
      setReportando(null);
      setViendoHoy(false);
    },
  };
}
