// Panel lateral (abajo en el celular) común: velo, <dialog>, encabezado con «Cerrar», cuerpo con el error y pie.
// También los ganchos de los paneles: cerrar con Escape y enviar una acción mostrando el error en palabras.
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { MedioPago } from '../api.ts';
import { enviarYReleer } from '../envio.ts';
import { crearPila } from '../pilaPaneles.ts';
import { textoMedio } from '../logica.ts';
import { Ico } from './Ico.tsx';

const pila = crearPila();
let escuchandoEscape = false;
const alTeclear = (ev: KeyboardEvent) => { if (ev.key === 'Escape') pila.escape(); };

/** Vuelve inerte todo lo que no es el panel ni sus ancestros; devuelve lo que marcó, para liberarlo al cerrar. */
function inertizarFondo(panel: HTMLElement | null): HTMLElement[] {
  const marcados: HTMLElement[] = [];
  for (let el = panel?.closest('.capa-panel') ?? null; el && el !== document.body; el = el.parentElement) {
    for (const hermano of Array.from(el.parentElement?.children ?? [])) {
      if (hermano !== el && hermano instanceof HTMLElement && !hermano.inert) {
        hermano.inert = true;
        marcados.push(hermano);
      }
    }
  }
  return marcados;
}

/**
 * Panel modal (HG-HAL-001 HAL-13): lo de atrás queda inerte (no se toca ni se enfoca), el foco entra al panel y vuelve
 * a donde estaba al cerrarlo, Escape cierra solo el panel de encima y la página de atrás no se desplaza.
 * Devuelve la referencia del <dialog> (con tabIndex={-1}) y un id único para su título.
 */
export function useModal(alCerrar: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const quitar = pila.abrir(() => cerrar.current());
    if (!escuchandoEscape) { document.addEventListener('keydown', alTeclear); escuchandoEscape = true; }
    document.body.style.overflow = 'hidden';
    const inertes = inertizarFondo(ref.current);
    ref.current?.focus();
    return () => {
      quitar();
      for (const el of inertes) el.inert = false;
      if (pila.abiertos() === 0) document.body.style.overflow = '';
      if (previo?.isConnected) previo.focus();
    };
  }, []);
  return { ref, tituloId };
}

/**
 * Envía una acción una sola vez a la vez; si falla, deja el mensaje de la API (o el de sin conexión) en `error`.
 * `releer` va aparte: si falla después de que la acción quedó, el aviso dice que no se repita (HAL-09).
 */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(accion: () => Promise<void>, releer: () => Promise<void> = async () => undefined) {
    setEnviando(true);
    setError('');
    const r = await enviarYReleer(accion, releer);
    setError(r.hecho ? r.aviso : r.error);
    setEnviando(false);
  }
  return { enviando, error, setError, enviar };
}

export function Panel({ titulo, subtitulo, error, pie, alCerrar, children }: {
  titulo: ComponentChildren; subtitulo?: ComponentChildren; error?: string; pie?: ComponentChildren; alCerrar: () => void; children?: ComponentChildren;
}) {
  const { ref, tituloId } = useModal(alCerrar);
  return (
    <div class="capa-panel">
      <button type="button" class="velo velo--visible" aria-hidden="true" tabIndex={-1} onClick={alCerrar} />
      <dialog open ref={ref} tabIndex={-1} class="panel" aria-modal="true" aria-labelledby={tituloId}>
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label="Cerrar" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
          <div class="titulos"><h2 id={tituloId}>{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
        </div>
        <div class="panel__cuerpo">
          {children}
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
        </div>
        {pie && <div class="panel__pie">{pie}</div>}
      </dialog>
    </div>
  );
}

const MEDIOS: MedioPago[] = ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'];

/** «¿Cómo paga?»: efectivo, Nequi o Bancolombia. */
export function OpcionesMedio({ medio, alElegir }: { medio: MedioPago; alElegir: (m: MedioPago) => void }) {
  return <div class="segmentado">{MEDIOS.map((m) =>
    <button key={m} type="button" class="opcion" aria-pressed={medio === m} onClick={() => alElegir(m)}>{textoMedio(m)}</button>)}</div>;
}
