// Cobrar una deuda de lavandería de un externo (TICKET-24): cuando vuelve y paga lo que quedó debiendo.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi } from '../api.ts';
import { pesos, textoMedio } from '../logica.ts';
import type { PedidoLavanderia } from '../lavanderia.ts';
import { Ico } from './Ico.tsx';

type Medio = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA';
const MEDIOS: Medio[] = ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'];

export function CobrarDeudaLavanderia({ pedido, alCerrar, alCobrar }: { pedido: PedidoLavanderia; alCerrar: () => void; alCobrar: (texto: string) => void }) {
  const [medio, setMedio] = useState<Medio>('EFECTIVO');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valor = pedido.por_cobrar ?? 0;

  useEffect(() => {
    const escape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', escape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', escape); document.body.style.overflow = ''; };
  }, []);

  async function cobrar() {
    setEnviando(true);
    setError('');
    try {
      await api.cobrarLavanderia(pedido.id, medio);
      alCobrar(`Se cobraron ${pesos(valor)} de la lavandería de ${pedido.cliente_nombre ?? ''}.`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div class="capa-panel">
      <button type="button" class="velo velo--visible" aria-label="Cerrar" tabIndex={-1} onClick={alCerrar} />
      <dialog open class="panel" aria-modal="true" aria-labelledby="panel-titulo">
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label="Cerrar" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
          <div class="titulos"><h2 id="panel-titulo">Cobrar deuda · {pedido.cliente_nombre}</h2><p>{pedido.detalle} · entregó {pedido.sin_pago_autorizado_por}</p></div>
        </div>
        <div class="panel__cuerpo">
          <div class="saldo saldo--aviso"><div><b>Debe</b><p>Se llevó la ropa sin pagar con la autorización de {pedido.sin_pago_autorizado_por}.</p></div><strong>{pesos(valor)}</strong></div>
          <section class="tarjeta"><div class="tarjeta__cab"><h3>¿Cómo paga?</h3></div>
            <div class="segmentado">{MEDIOS.map((m) =>
              <button key={m} type="button" class="opcion" aria-pressed={medio === m} onClick={() => setMedio(m)}>{textoMedio(m)}</button>)}</div>
          </section>
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
        </div>
        <div class="panel__pie">
          <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando || valor <= 0} onClick={cobrar}><Ico id="efectivo" clase="ico--s" />Cobrar {pesos(valor)}</button>
        </div>
      </dialog>
    </div>
  );
}
