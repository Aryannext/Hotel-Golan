// Tarjeta de Ingresos del día con indicador de variación y gráfico de área SVG (BOCETO 03).
import { pesos } from '../logica.ts';
import { textoVariacion } from '../inicio.ts';
import { Ico } from './Ico.tsx';

interface TarjetaIngresosProps {
  ingresos: number;
  variacion: number | null;
}

export function TarjetaIngresos({ ingresos, variacion }: TarjetaIngresosProps) {
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

        {/* Gráfico de onda / sparkline de ingresos fluido en SVG */}
        <div class="ingresos-dia__grafico" aria-hidden="true">
          <svg viewBox="0 0 280 65" preserveAspectRatio="none" class="sparkline-svg">
            <defs>
              <linearGradient id="gradiente-ingresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#DC2828" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#DC2828" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            {/* Área sombreada con degradado */}
            <path
              d="M 0 52 C 40 48, 70 56, 110 40 C 150 26, 180 44, 220 28 C 250 16, 270 20, 280 18 L 280 65 L 0 65 Z"
              fill="url(#gradiente-ingresos)"
            />
            {/* Trazo superior rojo suave */}
            <path
              d="M 0 52 C 40 48, 70 56, 110 40 C 150 26, 180 44, 220 28 C 250 16, 270 20, 280 18"
              fill="none"
              stroke="#DC2828"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
