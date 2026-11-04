import { useState } from 'preact/hooks';
import { api, ErrorApi, type Pago } from '../api.ts';
import { diaRelativo, horaBogota, hoyBogota, nuevaClave, pesos, textoMedio } from '../logica.ts';
import { Ico } from './Ico.tsx';
import { Panel } from './Panel.tsx';
import { origenPago } from '../ventas.ts';

export function PorConfirmar({ pagos, alCambiar }: { pagos: Pago[]; alCambiar: () => void }) {
  const [elegido, setElegido] = useState<Pago | null>(null);
  const [dudando, setDudando] = useState(false), [enviando, setEnviando] = useState(false), [error, setError] = useState('');
  const [claves] = useState(() => new Map<string, string>());
  const clave = (id: string) => claves.get(id) ?? (claves.set(id, nuevaClave()), claves.get(id)!);
  async function decidir(p: Pago, resultado: 'LLEGO' | 'NO_LLEGO') {
    if (enviando) return;
    setEnviando(true); setError('');
    try { await api.verificarPago(p.id, resultado, clave(p.id)); setElegido(null); setDudando(false); alCambiar(); }
    catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar. Intente de nuevo.'); alCambiar(); }
    finally { setEnviando(false); }
  }
  const hoy = hoyBogota(), total = pagos.reduce((s,p) => s + p.valor, 0);
  return <div class="caja-simple transferencias-vista">
    <div class="titulo-vista"><div><h1>Transferencias por confirmar</h1><p>Revisa el ingreso en Nequi o Bancolombia antes de confirmarlo.</p></div></div>
    <div class="transferencias-resumen">
      <section class="tarjeta"><b>{pagos.length}</b>Por verificar</section>
      <section class="tarjeta"><b>{pagos.filter(p => p.medio === 'NEQUI').length}</b>Nequi</section>
      <section class="tarjeta"><b>{pagos.filter(p => p.medio === 'BANCOLOMBIA').length}</b>Bancolombia</section>
      <section class="tarjeta transferencias-resumen__futuro" aria-label="Otro banco, pendiente de conexión al backend"><Ico id="banco" /><span>Otro banco</span><small>Pendiente de conexión</small></section>
    </div>
    <section class="tarjeta"><div class="tarjeta__cab"><h2>Pagos pendientes · {pesos(total)}</h2></div>
      {pagos.length === 0 ? <p class="vacio"><Ico id="check" clase="ico--s" />Todo al día: no hay transferencias pendientes.</p>
        : <div class="confirmar-tabla-scroll"><table class="confirmar-tabla"><thead><tr><th>Origen</th><th>Valor</th><th>Método</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
          {pagos.map(p => <tr key={p.id}>
            <td data-label="Origen">{origenPago(p)}</td>
            <td data-label="Valor"><strong>{pesos(p.valor)}</strong></td>
            <td data-label="Método">{textoMedio(p.medio)}</td>
            <td data-label="Fecha">{diaRelativo(p.registrado_en,hoy)} · {horaBogota(p.registrado_en)}</td>
            <td data-label="Estado"><span class="pill pill--aviso">Por verificar</span></td>
            <td data-label="Acción"><button type="button" class="btn btn--secundario" onClick={() => { setElegido(p); setError(''); setDudando(false); }}>Revisar</button></td>
          </tr>)}
        </tbody></table></div>}
      <p class="ayuda">Los bancos no están conectados al sistema. La administración verifica manualmente en su aplicación bancaria.</p>
    </section>
    {elegido && <Panel titulo="Revisar transferencia" subtitulo={origenPago(elegido)} alCerrar={() => setElegido(null)} error={error}>
      <section class="tarjeta"><div class="fila"><span>{textoMedio(elegido.medio)}</span><strong>{pesos(elegido.valor)}</strong></div><p class="ayuda">Registró {elegido.registrado_por} · {diaRelativo(elegido.registrado_en,hoy)} {horaBogota(elegido.registrado_en)}</p></section>
      <div class="nota nota--info"><Ico id="transferencia" clase="ico--s" /><p>Comprueba el valor y la fecha en tu banco. No se ha adjuntado un comprobante en este flujo.</p></div>
      {dudando ? <><p class="nota nota--alerta">Si no llegó, el saldo vuelve a quedar pendiente en la cuenta del huésped.</p><button type="button" class="btn btn--secundario" disabled={enviando} onClick={() => setDudando(false)}>Volver</button><button type="button" class="btn btn--peligro" disabled={enviando} onClick={() => void decidir(elegido,'NO_LLEGO')}>Confirmar: No llegó</button></>
        : <><button type="button" class="btn btn--primario" disabled={enviando} onClick={() => void decidir(elegido,'LLEGO')}><Ico id="check" clase="ico--s" />Llegó</button><button type="button" class="btn btn--secundario" disabled={enviando} onClick={() => setDudando(true)}>No llegó</button></>}
    </Panel>}
  </div>;
}
