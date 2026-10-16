// Actualización en vivo (ADR-005): eventos por SSE y, de respaldo, una consulta cada 30 s.
// Al (re)conectar se avisa `null` para que la pantalla vuelva a pedir el estado completo.
import { useEffect, useRef } from 'preact/hooks';
import type { EventoVivo } from './logica.ts';

const TIPOS = ['habitacion.actualizada', 'estadia.creada', 'estadia.cerrada', 'pago.por_verificar', 'pago.verificado', 'pago.rechazado',
  'turno.entregado', 'turno.recibido', 'turno.diferencia', 'caja.movimiento'];
const RESPALDO_MS = 30_000;

export function useEnVivo(activo: boolean, alEvento: (ev: EventoVivo | null) => void) {
  const manejador = useRef(alEvento);
  manejador.current = alEvento;

  useEffect(() => {
    if (!activo) return;
    const fuente = new EventSource('/api/v1/eventos');
    const recibir = (m: MessageEvent<string>) => manejador.current(JSON.parse(m.data) as EventoVivo);
    for (const t of TIPOS) fuente.addEventListener(t, recibir as EventListener);
    fuente.onopen = () => manejador.current(null);
    const respaldo = setInterval(() => manejador.current(null), RESPALDO_MS);
    return () => { clearInterval(respaldo); fuente.close(); };
  }, [activo]);
}
