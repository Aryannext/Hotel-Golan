// «Cobrar un daño» (TICKET-27; RN-18): solo la administración, que sabe cuánto vale reponerlo «como nuevo» (V5-06).
// Queda como un cargo más de la cuenta: sube el saldo y la salida espera a que se pague (RN-07).
import { useState } from 'preact/hooks';
import { api } from '../api.ts';
import { nuevaClave } from '../logica.ts';
import { leerDano } from '../danos.ts';
import { Ico } from './Ico.tsx';
import { useEnvio } from './Panel.tsx';

export function VistaDano({ estadiaId, alListo }: { estadiaId: string; alListo: () => Promise<void> }) {
  const [descripcion, setDescripcion] = useState('');
  const [valor, setValor] = useState('');
  const { enviando, error, setError, enviar } = useEnvio();
  // Una clave por envío: un doble toque o un reintento sin señal no lo duplican (Idempotency-Key).
  const [clave] = useState(nuevaClave);

  function cobrar() {
    const d = leerDano(descripcion, valor);
    if (!d.ok) { setError(d.error); return; }
    void enviar(async () => { await api.cobrarDano(estadiaId, d.descripcion, d.valor, clave); }, alListo);
  }

  return <>
    <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>Se cobra lo que cuesta reponerlo como nuevo. Queda en la cuenta: el huésped no sale hasta pagarlo.</p></div>
    {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
    <section class="tarjeta">
      <div class="campo"><label htmlFor="dano-descripcion">¿Qué se dañó?</label>
        <input id="dano-descripcion" autocomplete="off" maxLength={120} placeholder="Vaso roto" value={descripcion}
          onInput={(ev) => setDescripcion((ev.target as HTMLInputElement).value)} /></div>
      <div class="campo"><label htmlFor="dano-valor">Valor de reposición</label>
        <input id="dano-valor" inputmode="numeric" autocomplete="off" placeholder="25000" value={valor}
          onInput={(ev) => setValor((ev.target as HTMLInputElement).value)} /></div>
      <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={cobrar}><Ico id="alerta" clase="ico--s" />Cargar el daño a la cuenta</button>
    </section>
  </>;
}
