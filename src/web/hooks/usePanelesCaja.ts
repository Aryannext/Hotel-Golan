// Cuál de las siete ventanas de la Caja está abierta. Antes eran siete estados
// sueltos dentro de Caja.tsx y nada garantizaba que al abrir una se cerrara la otra;
// acá solo puede haber una abierta a la vez, y `ninguna` las cierra todas.
import { useState } from 'preact/hooks';
import type { QueAnular } from '../componentes/Anular.tsx';
import type { PedidoLavanderia } from '../lavanderia.ts';

/** Las que se abren sin llevar nada adentro. */
export type VentanaCaja = 'vender' | 'salio' | 'lavanderia-externa' | 'entregar-turno' | null;

export interface PanelesCaja {
  ventana: VentanaCaja;
  /** Pedido de lavandería que se está entregando, si hay alguno. */
  entregandoRopa: PedidoLavanderia | null;
  cobrandoDeuda: PedidoLavanderia | null;
  anulando: QueAnular | null;
  abrir: (v: VentanaCaja) => void;
  entregarRopa: (p: PedidoLavanderia | null) => void;
  cobrarDeuda: (p: PedidoLavanderia | null) => void;
  anular: (q: QueAnular | null) => void;
  ninguna: () => void;
}

export function usePanelesCaja(): PanelesCaja {
  const [ventana, setVentana] = useState<VentanaCaja>(null);
  const [entregandoRopa, setEntregandoRopa] = useState<PedidoLavanderia | null>(null);
  const [cobrandoDeuda, setCobrandoDeuda] = useState<PedidoLavanderia | null>(null);
  const [anulando, setAnulando] = useState<QueAnular | null>(null);

  const ninguna = () => {
    setVentana(null);
    setEntregandoRopa(null);
    setCobrandoDeuda(null);
    setAnulando(null);
  };

  return {
    ventana, entregandoRopa, cobrandoDeuda, anulando,
    abrir: (v) => { ninguna(); setVentana(v); },
    entregarRopa: (p) => { ninguna(); setEntregandoRopa(p); },
    cobrarDeuda: (p) => { ninguna(); setCobrandoDeuda(p); },
    anular: (q) => { ninguna(); setAnulando(q); },
    ninguna,
  };
}
