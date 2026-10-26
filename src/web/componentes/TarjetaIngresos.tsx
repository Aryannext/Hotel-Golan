// Tarjeta de Ingresos del día con indicador de variación y gráfico de área SVG (BOCETO 03).
import { pesos } from '../logica.ts';
import { textoVariacion } from '../inicio.ts';
import { Ico } from './Ico.tsx';

interface TarjetaIngresosProps {
  ingresos: number;
  variacion: number | null;
  /** Trazo de los últimos días; null cuando no hay con qué dibujar una línea. */
  trazo: string | null;
}

export function TarjetaIngresos({ ingresos, variacion, trazo }: TarjetaIngresosProps) {
  const tieneVariacion = variacion !== null;
  const esPositivo = (variacion ?? 0) >= 0;
  const textoComp = tieneVariacion ? textoVariacion(variacion) : null;

  return (
    <section class="tarjeta widget-admin" aria-label="Ingresos del día">
      <div class="tarjeta__cab">
        <h2><Ico id="reportes" clase="ico--s" />Ingresos del día</h2>
      </div>

      <div class="ingresos-dia">
        <div class="ingresos-dia__fila">
          <strong class="ingresos-dia__monto">{pesos(ingresos)}</strong>
          {tieneVariacion && (
            <span class={`badge-variacion ${esPositivo ? 'badge-variacion--positivo' : 'badge-variacion--negativo'}`}>
              <span class="badge-variacion__flecha">{esPositivo ? '↑' : '↓'}</span>
              {textoComp}
            </span>
          )}
        </div>

        {/* Lo cobrado en los últimos días. Antes aquí había una onda fija que subía
            siempre, con ingresos o sin ellos; ahora el trazo sale de /reportes/dias
            y, si no hay al menos dos días para comparar, no se dibuja nada. */}
        {trazo && <div class="ingresos-dia__grafico" aria-hidden="true">
          <svg viewBox="0 0 280 65" preserveAspectRatio="none" class="sparkline-svg">
            <defs>
              <linearGradient id="gradiente-ingresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#DC2828" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#DC2828" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <path d={`${trazo} L 280 65 L 0 65 Z`} fill="url(#gradiente-ingresos)" />
            <path d={trazo} fill="none" stroke="#DC2828" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </div>}
      </div>
    </section>
  );
}
