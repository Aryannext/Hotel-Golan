// Recibir el turno (TICKET-03, FR-14): un toque si el efectivo coincide; si no, se escribe lo contado y el motivo.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Turno } from '../api.ts';
import { diferenciaConteo, leerPesos, nombreTurno, pesos } from '../logica.ts';
import { Ico } from './Ico.tsx';

export function RecibirTurno({ alRecibir }: { alRecibir: () => void }) {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [otro, setOtro] = useState(false);
  const [contado, setContado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.turnoActual()
      // Si ya está abierto (lo recibió otra persona), no hay nada que recibir.
      .then((t) => (t.estado === 'POR_RECIBIR' ? setTurno(t) : alRecibir()))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function recibir(valor: number, porque?: string) {
    setEnviando(true);
    setError('');
    try {
      await api.recibirTurno(valor, porque);
      alRecibir();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema.');
    } finally {
      setEnviando(false);
    }
  }

  function enviarOtro(ev: Event) {
    ev.preventDefault();
    const valor = leerPesos(contado);
    if (valor === null) { setError('Escriba cuánto efectivo contó.'); return; }
    if (valor !== turno!.base_entregada && motivo.trim().length < 5) { setError('Explique por qué no coincide (mínimo 5 letras).'); return; }
    void recibir(valor, valor === turno!.base_entregada ? undefined : motivo.trim()); // recibir() muestra sus propios errores
  }

  if (!turno) return error ? <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div> : null;
  const entregado = turno.base_entregada;
  const valor = leerPesos(contado);
  const dif = valor === null ? null : diferenciaConteo(valor, entregado);

  return (
    <div class="caja-simple">
      <div class="titulo-vista"><div><h1>Recibir el turno</h1><p>Turno {nombreTurno(turno.tipo)}</p></div></div>
      <section class="tarjeta pila" style="gap:14px">
        <div class="nota nota--info"><Ico id="caja" clase="ico--s" />
          <p>{turno.recibido_de ? <><b>{turno.recibido_de}</b> le dejó</> : 'Le dejaron'} <b>{pesos(entregado)}</b> en la caja. Cuente el efectivo antes de confirmar.</p>
        </div>
        {!otro ? <>
          <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={() => recibir(entregado)}>
            <Ico id="check" clase="ico--s" />Sí, recibo {pesos(entregado)}
          </button>
          <button type="button" class="btn btn--secundario btn--l btn--bloque" disabled={enviando} onClick={() => { setOtro(true); setError(''); }}>
            Conté otro valor
          </button>
        </> : (
          <form class="pila" style="gap:12px" onSubmit={enviarOtro} noValidate>
            <div class={`campo${error && valor === null ? ' campo--error' : ''}`}>
              <label htmlFor="contado">¿Cuánto contó en la caja?</label>
              <input id="contado" inputmode="numeric" autocomplete="off" placeholder={`Ej. ${entregado}`} value={contado}
                onInput={(e) => setContado((e.target as HTMLInputElement).value)} />
            </div>
            {dif && <p><span class={`pill pill--${dif.tono}`}>{dif.texto}</span></p>}
            {dif?.tono === 'alerta' && <div class="campo">
              <label htmlFor="motivo">¿Por qué no coincide? <span class="req">*</span></label>
              <textarea id="motivo" rows={2} maxLength={300} value={motivo} onInput={(e) => setMotivo((e.target as HTMLTextAreaElement).value)} />
              <span class="ayuda">Se le avisa a la administración.</span>
            </div>}
            <button type="submit" class="btn btn--primario btn--l btn--bloque" disabled={enviando}><Ico id="check" clase="ico--s" />Recibir con este valor</button>
            <button type="button" class="enlace" onClick={() => { setOtro(false); setError(''); }}>Volver</button>
          </form>
        )}
        {error && <p class="campo__error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
