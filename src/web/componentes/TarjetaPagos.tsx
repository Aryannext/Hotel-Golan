// Tarjeta de Pagos del día con desglose por Efectivo, Nequi y Bancolombia (BOCETO 03).
import { pesos } from '../logica.ts';
import { Ico } from './Ico.tsx';

interface TarjetaPagosProps {
  efectivo: number;
  nequi: number;
  bancolombia: number;
}

export function TarjetaPagos({ efectivo, nequi, bancolombia }: TarjetaPagosProps) {
  return (
    <section class="tarjeta widget-admin" aria-label="Pagos del día">
      <div class="tarjeta__cab">
        <h2><Ico id="tarjeta-pago" clase="ico--s" />Pagos del día</h2>
      </div>

      <ul class="lista-pagos-dia">
        <li class="pago-item">
          <div class="pago-item__marca">
            <span class="pago-item__ico pago-item__ico--efectivo">
              <Ico id="efectivo" clase="ico--s" />
            </span>
            <span class="pago-item__nombre">Efectivo</span>
          </div>
          <strong class="pago-item__valor">{pesos(efectivo)}</strong>
        </li>

        <li class="pago-item">
          <div class="pago-item__marca">
            <span class="pago-item__ico pago-item__ico--nequi">
              <Ico id="nequi" clase="ico--s" />
            </span>
            <span class="pago-item__nombre">Nequi</span>
          </div>
          <strong class="pago-item__valor">{pesos(nequi)}</strong>
        </li>

        <li class="pago-item">
          <div class="pago-item__marca">
            <span class="pago-item__ico pago-item__ico--bancolombia">
              <Ico id="bancolombia" clase="ico--s" />
            </span>
            <span class="pago-item__nombre">Bancolombia</span>
          </div>
          <strong class="pago-item__valor">{pesos(bancolombia)}</strong>
        </li>
      </ul>
    </section>
  );
}
