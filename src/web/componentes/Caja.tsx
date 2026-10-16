// Caja del turno (TICKET-03, FR-11): el número que importa es cuánta plata debe haber ahora en la caja (RN-10).
// TICKET-10: «Salió plata» y «Lo de este turno» (cobros y salidas por hora). TICKET-11: «Entregar turno».
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Turno } from '../api.ts';
import { horaBogota, lineasDelTurno, nombreTurno, pesos, type LineaTurno } from '../logica.ts';
import { SalidaDinero } from './SalidaDinero.tsx';
import { EntregarTurno } from './EntregarTurno.tsx';
import { Ico } from './Ico.tsx';

/** `recarga` cambia con cada evento en vivo: la caja se vuelve a pedir sin recargar la página. */
export function Caja({ recarga = 0, usuario, alAvisar, alEntregar }: {
  recarga?: number; usuario?: string; alAvisar?: (texto: string) => void; alEntregar?: (texto: string) => void;
}) {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [lineas, setLineas] = useState<LineaTurno[]>([]);
  const [error, setError] = useState('');
  const [saliendo, setSaliendo] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [propia, setPropia] = useState(0);

  useEffect(() => {
    api.turnoActual().then(async (t) => {
      setTurno(t);
      setError('');
      const [p, m] = await Promise.all([api.pagosDelTurno(t.id), api.salidasDelTurno(t.id)]);
      setLineas(lineasDelTurno(p.items, m.items));
    }).catch((e) =>
      setError(e instanceof ErrorApi && e.estado === 404 ? 'No hay un turno activo en este momento.' : e.message));
  }, [recarga, propia]);

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
        {!porRecibir && <div class="caja-grande__botones caja-grande__botones--uno">
          <button type="button" class="btn btn--secundario btn--l" onClick={() => setSaliendo(true)}><Ico id="baja" clase="ico--s" />Salió plata</button>
        </div>}
      </section>

      {!porRecibir && <section class="tarjeta"><div class="tarjeta__cab"><h2>Lo de este turno</h2></div>
        {lineas.length === 0 ? <p class="vacio">Todavía no hay cobros ni salidas en este turno.</p> : lineas.map((l) => (
          <div class={`mov${l.anulado ? ' mov--anulado' : ''}`} key={l.id}>
            <span class="mov__ico"><Ico id={l.valor < 0 ? 'baja' : l.enCaja ? 'efectivo' : 'transferencia'} clase="ico--s" /></span>
            <div class="mov__txt"><div class="mov__titulo">{l.concepto}</div>
              <div class="mov__detalle">{horaBogota(l.hora)} · {l.por}{!l.enCaja ? ' · no entra a la caja' : ''}{l.anulado ? ' · anulado' : ''}</div></div>
            <div class="mov__der"><span class={`mov__valor${l.valor < 0 ? ' negativo' : ''}`}>{l.valor < 0 ? '−' : ''}{pesos(Math.abs(l.valor))}</span>
              {l.estado === 'POR_VERIFICAR' && <span class="pill pill--aviso">Por verificar</span>}
              {l.estado === 'RECHAZADO' && <span class="pill pill--alerta">No llegó</span>}</div>
          </div>
        ))}
      </section>}
      {turno.estado === 'ABIERTO' && turno.responsable === usuario && <>
        <button type="button" class="btn btn--primario btn--l btn--bloque" onClick={() => setEntregando(true)}><Ico id="check" clase="ico--s" />Entregar turno</button>
        <p class="ayuda" style="text-align:center">Entregue al terminar su horario, cuando llegue quien lo recibe.</p>
      </>}

      {saliendo && <SalidaDinero debeHaber={c.debe_haber} alCerrar={() => setSaliendo(false)}
        alRegistrar={(texto) => { setSaliendo(false); setPropia((n) => n + 1); alAvisar?.(texto); }} />}
      {entregando && <EntregarTurno turno={turno} alCerrar={() => setEntregando(false)} alEntregar={(texto) => { setEntregando(false); alEntregar?.(texto); }} />}
    </div>
  );
}
