// Lo que la pantalla de Caja lee del turno abierto: el turno con su resumen, los
// movimientos, la ropa por entregar y las deudas de lavandería. Se vuelve a pedir
// con cada evento en vivo (`recarga`) y también cuando esta misma pantalla registra
// algo, que es para lo que sirve `recargar`.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Turno } from '../api.ts';
import { lineasDelTurno, type LineaTurno } from '../logica.ts';
import type { PedidoLavanderia } from '../lavanderia.ts';

export interface DatosCaja {
  turno: Turno | null;
  lineas: LineaTurno[];
  lavanderia: PedidoLavanderia[];
  deudas: PedidoLavanderia[];
  error: string;
  /** Vuelve a pedirlo todo después de registrar algo desde esta pantalla. */
  recargar: () => void;
}

export function useDatosCaja(recarga: number): DatosCaja {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [lineas, setLineas] = useState<LineaTurno[]>([]);
  const [lavanderia, setLavanderia] = useState<PedidoLavanderia[]>([]);
  const [deudas, setDeudas] = useState<PedidoLavanderia[]>([]);
  const [error, setError] = useState('');
  const [propia, setPropia] = useState(0);

  useEffect(() => {
    api.turnoActual().then(async (t) => {
      setTurno(t);
      setError('');
      const [p, m, l, d] = await Promise.all([
        api.pagosDelTurno(t.id), api.salidasDelTurno(t.id), api.lavanderiaPorEntregar(), api.deudasLavanderia(),
      ]);
      setLineas(lineasDelTurno(p.items, m.items));
      setLavanderia(l.items);
      setDeudas(d.items);
    }).catch((e) =>
      setError(e instanceof ErrorApi && e.estado === 404 ? 'No hay un turno activo en este momento.' : e.message));
  }, [recarga, propia]);

  return { turno, lineas, lavanderia, deudas, error, recargar: () => setPropia((n) => n + 1) };
}
