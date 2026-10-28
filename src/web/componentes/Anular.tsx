// Anular un cobro o una salida de dinero (TICKET-12, FR-17): solo la administración, con motivo. Nada se borra.
import { useState } from 'preact/hooks';
import { api, ErrorApi } from '../api.ts';
import { pesos } from '../logica.ts';
import { Ico } from './Ico.tsx';
import { useModal } from './Panel.tsx';

export interface QueAnular { id: string; origen: 'PAGO' | 'SALIDA'; concepto: string; valor: number }

export function Anular({ que, alCerrar, alAnular }: { que: QueAnular; alCerrar: () => void; alAnular: (texto: string) => void }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { ref, tituloId } = useModal(alCerrar);

  async function anular() {
    if (motivo.trim().length < 5) { setError('Escriba el motivo (mínimo 5 letras).'); return; }
    setEnviando(true);
    setError('');
    try {
      await (que.origen === 'PAGO' ? api.anularPago(que.id, motivo.trim()) : api.anularSalida(que.id, motivo.trim()));
      alAnular(`Anulado: ${que.concepto} (${pesos(Math.abs(que.valor))}). Sigue visible, marcado como anulado.`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo.');
      setEnviando(false);
    }
  }

  return (
    <div class="capa-panel capa-panel--encima">
      <button type="button" class="velo velo--visible" aria-hidden="true" tabIndex={-1} onClick={alCerrar} />
      <dialog open ref={ref} tabIndex={-1} class="panel" aria-modal="true" aria-labelledby={tituloId}>
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label="Cerrar" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
          <div class="titulos"><h2 id={tituloId}>Anular {que.origen === 'PAGO' ? 'cobro' : 'salida de dinero'}</h2><p>{que.concepto} · {pesos(Math.abs(que.valor))}</p></div>
        </div>
        <div class="panel__cuerpo">
          <div class="nota"><Ico id="info" clase="ico--s" /><p>No se borra: queda visible y marcado como anulado, con su nombre y la hora. La caja y la cuenta se recalculan solas.</p></div>
          <div class="campo"><label htmlFor="motivo-anular">¿Por qué se anula? <span class="req">*</span></label>
            <textarea id="motivo-anular" rows={2} maxLength={200} placeholder="Ej. se registró dos veces" value={motivo} onInput={(e) => setMotivo((e.target as HTMLTextAreaElement).value)} /></div>
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
        </div>
        <div class="panel__pie">
          <button type="button" class="btn btn--peligro btn--l btn--bloque" disabled={enviando} onClick={anular}><Ico id="papelera" clase="ico--s" />Anular</button>
        </div>
      </dialog>
    </div>
  );
}
