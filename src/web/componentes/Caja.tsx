// Caja del turno (TICKET-03, FR-11): el número que importa es cuánta plata debe haber ahora en la caja (RN-10).
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Turno } from '../api.ts';
import { nombreTurno, pesos } from '../logica.ts';
import { Ico } from './Ico.tsx';

/** `recarga` cambia con cada evento en vivo: la caja se vuelve a pedir sin recargar la página. */
export function Caja({ recarga = 0 }: { recarga?: number }) {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.turnoActual().then(setTurno).catch((e) =>
      setError(e instanceof ErrorApi && e.estado === 404 ? 'No hay un turno activo en este momento.' : e.message));
  }, [recarga]);

  if (error) return <div class="nota" role="alert"><Ico id="info" clase="ico--s" /><p>{error}</p></div>;
  if (!turno) return null;
  const c = turno.caja;
  const porRecibir = turno.estado === 'POR_RECIBIR';

  return (
    <div class="caja-simple">
      <div class="titulo-vista"><div><h1>Caja</h1>
        <p>Turno {nombreTurno(turno.tipo)} · {porRecibir ? 'por recibir' : <>de <b>{turno.responsable}</b></>}</p>
      </div></div>
      <section class="tarjeta caja-grande">
        <p class="caja-grande__etq">{porRecibir ? 'Dejaron en la caja' : 'En la caja debe haber'}</p>
        <strong class="caja-grande__valor">{pesos(c.debe_haber)}</strong>
        <p class="ayuda">
          {porRecibir ? `${turno.recibido_de ?? 'El turno anterior'} entregó ${pesos(turno.base_entregada)}; falta que alguien lo reciba.`
            : `Recibió ${pesos(c.base_recibida)} + cobró en efectivo ${pesos(c.efectivo)}${c.salidas ? ' − salió ' + pesos(c.salidas) : ''}`}
        </p>
        <div class="caja-grande__extra">
          <span><Ico id="transferencia" clase="ico--s" /> Transferencias (no están en la caja): <b>{pesos(c.transferencias)}</b>
            {c.por_verificar_cantidad > 0 && ` · ${c.por_verificar_cantidad} por verificar`}</span>
          {!porRecibir && <span><Ico id="efectivo" clase="ico--s" /> Pago del turno al entregar: <b>{pesos(c.pago_turno)}</b></span>}
        </div>
      </section>
      <p class="ayuda" style="text-align:center">Registrar cobros, salidas de dinero y entregar el turno se habilita en las siguientes entregas.</p>
    </div>
  );
}
