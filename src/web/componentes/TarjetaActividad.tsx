// Tarjeta de Actividad reciente para la administración (BOCETO 03).
import { pesos } from '../logica.ts';
import type { EventoReciente } from '../inicio.ts';
import { Ico } from './Ico.tsx';

interface TarjetaActividadProps {
  eventos: EventoReciente[];
  alVerTodas: () => void;
}

export function TarjetaActividad({ eventos, alVerTodas }: TarjetaActividadProps) {
  return (
    <section class="tarjeta widget-admin" aria-label="Actividad reciente">
      <div class="tarjeta__cab tarjeta__cab--entre">
        <h2><Ico id="reloj" clase="ico--s" />Actividad reciente</h2>
        <button type="button" class="enlace enlace--s" onClick={alVerTodas}>
          Ver todas <Ico id="flecha" clase="ico--xs" />
        </button>
      </div>

      <ul class="lista-actividad">
        {eventos.length === 0 ? (
          <li class="actividad-item actividad-item--vacio">
            <span>Sin movimientos registrados en este turno</span>
          </li>
        ) : (
          eventos.map((ev) => (
            <li key={ev.id} class="actividad-item">
              <span class="actividad-item__hora">{ev.hora}</span>
              <span class="actividad-item__concepto" title={ev.concepto}>{ev.concepto}</span>
              <strong class="actividad-item__valor">{pesos(ev.valor)}</strong>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
