// Pagos del turno abierto, por Efectivo, Nequi y Bancolombia (BOCETO 03).
// Dice «del turno» y no «del día» porque eso es lo que trae /pagos?turno_id=…:
// lo cobrado en el turno en curso. El informe del día solo cuenta turnos ya
// entregados, así que las dos cifras no tienen por qué coincidir.
import { pesos } from '../logica.ts';
import { Ico } from './Ico.tsx';

interface TarjetaPagosProps {
  efectivo: number;
  nequi: number;
  bancolombia: number;
  /** Transferencias sin separar, para cuando no se sabe cuánto fue de cada una. */
  transferencias: number;
  /** false cuando no hay pagos del turno y Nequi y Bancolombia no se pueden separar. */
  detallado: boolean;
}

export function TarjetaPagos({ efectivo, nequi, bancolombia, transferencias, detallado }: TarjetaPagosProps) {
  return (
    <section class="tarjeta widget-admin" aria-label="Pagos del turno">
      <div class="tarjeta__cab">
        <h2><Ico id="tarjeta-pago" clase="ico--s" />Pagos del turno</h2>
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

        {/* Sin los pagos del turno, el informe del día trae las transferencias juntas:
            se muestran como una sola línea en vez de repartirlas entre las dos. */}
        {detallado ? <>
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
        </> : <li class="pago-item">
          <div class="pago-item__marca">
            <span class="pago-item__ico pago-item__ico--nequi">
              <Ico id="transferencia" clase="ico--s" />
            </span>
            <span class="pago-item__nombre">Transferencias</span>
          </div>
          <strong class="pago-item__valor">{pesos(transferencias)}</strong>
        </li>}
      </ul>
    </section>
  );
}
