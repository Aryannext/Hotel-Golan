import { useId, useState } from 'preact/hooks';
import { Ico } from './Ico.tsx';
import { Panel } from './Panel.tsx';

/** Opciones visuales pendientes de soporte en la API. Nunca se envían como otro medio. */
export function BancosAdicionales() {
  const [seleccion, setSeleccion] = useState(false);
  const [banco, setBanco] = useState('');
  const [formulario, setFormulario] = useState(false);
  const [valor, setValor] = useState('');
  const [referencia, setReferencia] = useState('');
  const id = useId();
  return <div class="bancos-adicionales">
    <div class="bancos-adicionales__opciones">
      <button type="button" class="metodo-pago-pill" aria-pressed={seleccion} onClick={() => setSeleccion(!seleccion)}><Ico id="banco" clase="ico--s" /><span>Otro banco</span></button>
    </div>
    {seleccion && <div class="campo"><label htmlFor={id}>Nombre del banco</label><input id={id} value={banco} maxLength={80} placeholder="Escribe el nombre del banco" autoComplete="off" onInput={(ev) => setBanco((ev.target as HTMLInputElement).value)} /></div>}
    {seleccion && banco.trim() && <button type="button" class="btn btn--primario bancos-adicionales__registrar" onClick={() => setFormulario(true)}><Ico id="mas" clase="ico--s" /> Registrar pago</button>}
    {seleccion && <p class="bancos-adicionales__estado">Formulario de muestra · Pendiente de conexión al registro de pagos.</p>}
    {formulario && <Panel titulo="Registrar pago" subtitulo={banco.trim()} alCerrar={() => setFormulario(false)} pie={<button type="button" class="btn btn--primario btn--bloque" disabled>Registro pendiente de conexión</button>}>
      <section class="tarjeta">
        <div class="tarjeta__cab"><h3>Datos del pago</h3></div>
        <div class="campo"><label htmlFor={`${id}-banco`}>Banco</label><input id={`${id}-banco`} value={banco.trim()} readOnly /></div>
        <div class="campo"><label htmlFor={`${id}-valor`}>Valor de la transferencia</label><input id={`${id}-valor`} inputMode="numeric" autoComplete="off" placeholder="Ej. 50000" value={valor} onInput={(ev) => setValor((ev.target as HTMLInputElement).value)} /></div>
        <div class="campo"><label htmlFor={`${id}-referencia`}>Referencia (opcional)</label><input id={`${id}-referencia`} maxLength={100} autoComplete="off" placeholder="Número de comprobante" value={referencia} onInput={(ev) => setReferencia((ev.target as HTMLInputElement).value)} /></div>
        <p class="ayuda" role="status">Solo formulario visual. No registra pagos ni modifica el saldo. El encargado debe conectar esta opción al backend.</p>
      </section>
    </Panel>}
  </div>;
}
