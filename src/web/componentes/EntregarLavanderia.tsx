// Entregar la ropa lavada (TICKET-23; RN-22): se cobra lo que falta del pedido; sin pago, solo con la autorización
// de quien entrega (queda registrada y la deuda sigue en la cuenta: nadie sale debiendo, RN-07).
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi } from '../api.ts';
import { pesos, textoMedio } from '../logica.ts';
import { faltaParaEntregar, quienPidio, textoEntrega, type PedidoLavanderia } from '../lavanderia.ts';
import { Ico } from './Ico.tsx';

type Medio = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA';
const MEDIOS: Medio[] = ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'];

export function EntregarLavanderia({ pedido, alCerrar, alEntregar }: { pedido: PedidoLavanderia; alCerrar: () => void; alEntregar: (texto: string) => void }) {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [medio, setMedio] = useState<Medio>('EFECTIVO');
  const [autorizo, setAutorizo] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const quien = quienPidio(pedido);

  useEffect(() => {
    if (pedido.estadia_id) api.estadia(pedido.estadia_id).then((e) => setSaldo(e.cuenta.saldo)).catch((e: Error) => setError(e.message));
    const escape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', escape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', escape); document.body.style.overflow = ''; };
  }, []);

  const falta = faltaParaEntregar(pedido, saldo);

  async function entregar(sinPago: boolean) {
    setEnviando(true);
    setError('');
    try {
      await api.entregarLavanderia(pedido.id, sinPago ? { sin_pago_autorizado: true } : { cobro: { medio } });
      if (!falta) alEntregar(textoEntrega(quien, 'pagado', 0));
      else alEntregar(textoEntrega(quien, sinPago ? 'sin_pago' : 'cobrado', falta));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  let pie = null;
  if (falta === 0) {
    pie = <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={() => entregar(false)}><Ico id="check" clase="ico--s" />Entregar la ropa</button>;
  } else if (falta) {
    pie = autorizo
      ? <button type="button" class="btn btn--peligro btn--l btn--bloque" disabled={enviando} onClick={() => entregar(true)}><Ico id="alerta" clase="ico--s" />Entregar sin cobrar</button>
      : <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={() => entregar(false)}><Ico id="efectivo" clase="ico--s" />Cobrar {pesos(falta)} y entregar</button>;
  }
  return (
    <div class="capa-panel">
      <button type="button" class="velo velo--visible" aria-label="Cerrar" tabIndex={-1} onClick={alCerrar} />
      <dialog open class="panel" aria-modal="true" aria-labelledby="panel-titulo">
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label="Cerrar" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
          <div class="titulos"><h2 id="panel-titulo">Entregar lavandería · {quien}</h2><p>{pedido.detalle} · {pesos(pedido.total)}</p></div>
        </div>
        <div class="panel__cuerpo">
          {falta === null && !error && <p><output>Consultando la cuenta…</output></p>}
          {falta === 0 && <div class="saldo saldo--ok"><div><b>Ya está pagado</b><p>{pedido.estadia_id ? 'La cuenta de la habitación no debe este lavado.' : 'Lo pagó por adelantado.'}</p></div><strong>{pesos(0)}</strong></div>}
          {!!falta && <>
            <div class="saldo saldo--aviso"><div><b>Falta por pagar</b><p>Sin pago no se entrega la ropa.</p></div><strong>{pesos(falta)}</strong></div>
            {!autorizo && <section class="tarjeta"><div class="tarjeta__cab"><h3>¿Cómo paga?</h3></div>
              <div class="segmentado">{MEDIOS.map((m) =>
                <button key={m} type="button" class="opcion" aria-pressed={medio === m} onClick={() => setMedio(m)}>{textoMedio(m)}</button>)}</div>
              {medio !== 'EFECTIVO' && <p class="ayuda">Quedará «por confirmar» hasta que la administración revise que llegó.</p>}
            </section>}
            <label class="casilla casilla--aviso">
              <input type="checkbox" checked={autorizo} onChange={(e) => setAutorizo((e.target as HTMLInputElement).checked)} />
              <span>No paga ahora: <b>yo autorizo entregar la ropa sin pago</b> y asumo el riesgo. {pedido.estadia_id ? 'La deuda queda en la cuenta de la habitación.' : 'La deuda queda a su nombre.'}</span></label>
          </>}
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
        </div>
        {pie && <div class="panel__pie">{pie}</div>}
      </dialog>
    </div>
  );
}
