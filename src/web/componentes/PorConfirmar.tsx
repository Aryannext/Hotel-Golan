// «Pagos por confirmar» (TICKET-05, FR-15; RN-12): la administración confirma con un toque si la transferencia llegó.
import { useState } from 'preact/hooks';
import { api, ErrorApi, type Pago } from '../api.ts';
import { diaRelativo, horaBogota, hoyBogota, nuevaClave, pesos, textoMedio } from '../logica.ts';
import { Ico } from './Ico.tsx';
import { origenPago } from '../ventas.ts';
import { TRANSFERENCIAS_SIN_REVISAR } from '../avisos.ts';

export function PorConfirmar({ pagos, sinRevisar, alCambiar }: { pagos: Pago[]; sinRevisar: boolean; alCambiar: () => void }) {
  const [dudando, setDudando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Una clave por pago: si se toca dos veces o se reintenta, no se aplica dos veces.
  const [claves] = useState(() => new Map<string, string>());
  const clave = (id: string) => claves.get(id) ?? (claves.set(id, nuevaClave()), claves.get(id)!);

  async function decidir(p: Pago, resultado: 'LLEGO' | 'NO_LLEGO') {
    setEnviando(p.id);
    setError('');
    try {
      await api.verificarPago(p.id, resultado, clave(p.id));
      setDudando(null);
      alCambiar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo.');
      alCambiar();
    } finally {
      setEnviando(null);
    }
  }

  const hoy = hoyBogota();
  return (
    <div class="caja-simple">
      <div class="titulo-vista"><div><h1>Pagos por confirmar</h1>
        <p>Revise en Nequi o Bancolombia si llegó la plata y toque una opción.</p></div></div>
      {error && <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
      {/* Sin respuesta del sistema, una lista vacía no quiere decir que no haya transferencias (HAL-07). */}
      {sinRevisar && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{TRANSFERENCIAS_SIN_REVISAR}</p></div>}
      {pagos.length === 0 && !sinRevisar
        ? <section class="tarjeta"><p class="vacio"><Ico id="check" clase="ico--s" /> Todo al día: no hay transferencias por confirmar.</p></section>
        : pagos.map((p) => (
          <section class="tarjeta confirmar" key={p.id}>
            <div class="confirmar__cab">
              <span class="pill pill--medio"><Ico id="transferencia" clase="ico--xs" />{textoMedio(p.medio)}</span>
              <strong class="confirmar__valor">{pesos(p.valor)}</strong>
            </div>
            <p class="ayuda"><b>{origenPago(p)}</b> · {diaRelativo(p.registrado_en, hoy)} a las {horaBogota(p.registrado_en)} · registró {p.registrado_por}</p>
            {dudando === p.id
              ? <div class="confirmar__botones">
                <p class="confirmar__pregunta">¿Seguro que no llegó? Recepción tendrá que cobrarla de nuevo.</p>
                <button type="button" class="btn btn--suave btn--l" disabled={enviando === p.id} onClick={() => setDudando(null)}>Volver</button>
                <button type="button" class="btn btn--peligro btn--l" disabled={enviando === p.id} onClick={() => decidir(p, 'NO_LLEGO')}>Sí, no llegó</button>
              </div>
              : <div class="confirmar__botones">
                <button type="button" class="btn btn--secundario btn--l" disabled={enviando === p.id} onClick={() => setDudando(p.id)}>No llegó</button>
                <button type="button" class="btn btn--primario btn--l" disabled={enviando === p.id} onClick={() => decidir(p, 'LLEGO')}><Ico id="check" clase="ico--s" />Llegó</button>
              </div>}
          </section>
        ))}
    </div>
  );
}
