// Gráfico circular (dona) de ocupación de habitaciones (BOCETO 03).
// SVG accesible, escalable y ligero sin librerías externas.
import { calcularSegmentosDona } from '../inicio.ts';
import { Ico } from './Ico.tsx';

interface GraficoOcupacionProps {
  ocupadas: number;
  libres: number;
  limpieza: number;
  total: number;
  porcentaje: number;
}

export function GraficoOcupacion({ ocupadas, libres, limpieza, porcentaje }: GraficoOcupacionProps) {
  const radio = 36;
  const { segmentos } = calcularSegmentosDona(ocupadas, libres, limpieza, radio);

  return (
    <section class="tarjeta widget-admin" aria-label="Ocupación de habitaciones">
      <div class="tarjeta__cab">
        <h2><Ico id="dona" clase="ico--s" />Ocupación de habitaciones</h2>
      </div>
      <div class="ocupacion-dona">
        <div class="ocupacion-dona__grafico">
          <svg viewBox="0 0 100 100" class="dona-svg" role="img" aria-label={`Ocupación: ${porcentaje}%`}>
            {/* Círculo base de fondo gris claro */}
            <circle cx="50" cy="50" r={radio} fill="none" stroke="var(--borde)" stroke-width="12" />
            {/* Segmentos de color rotados -90deg para comenzar en la parte superior */}
            <g transform="rotate(-90 50 50)">
              {segmentos.map((s) => (
                <circle
                  key={s.clase}
                  cx="50"
                  cy="50"
                  r={radio}
                  fill="none"
                  stroke={s.color}
                  stroke-width="12"
                  stroke-dasharray={s.dasharray}
                  stroke-dashoffset={s.dashoffset}
                  stroke-linecap="round"
                />
              ))}
            </g>
          </svg>
          <div class="ocupacion-dona__centro">
            <span class="ocupacion-dona__cifra">{porcentaje}%</span>
            <span class="ocupacion-dona__etiqueta">Ocupación</span>
          </div>
        </div>

        <ul class="ocupacion-dona__leyenda">
          <li class="leyenda-item">
            <span class="leyenda-punto leyenda-punto--ocupada" />
            <span class="leyenda-texto">Ocupadas</span>
            <strong class="leyenda-valor">{ocupadas}</strong>
          </li>
          <li class="leyenda-item">
            <span class="leyenda-punto leyenda-punto--libre" />
            <span class="leyenda-texto">Libres</span>
            <strong class="leyenda-valor">{libres}</strong>
          </li>
          <li class="leyenda-item">
            <span class="leyenda-punto leyenda-punto--limpieza" />
            <span class="leyenda-texto">En limpieza</span>
            <strong class="leyenda-valor">{limpieza}</strong>
          </li>
        </ul>
      </div>
    </section>
  );
}
