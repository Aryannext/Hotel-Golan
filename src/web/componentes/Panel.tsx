// Columna contextual común: junto al contenido en escritorio; completa en móvil.
// También los ganchos de los paneles: cerrar con Escape y enviar una acción mostrando el error en palabras.
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import type { MedioPago } from '../api.ts';
import { enviarYReleer } from '../envio.ts';
import { crearPila } from '../pilaPaneles.ts';
import { textoMedio } from '../logica.ts';
import { Ico } from './Ico.tsx';

/** En el celular el panel ocupa toda la pantalla: ahí se comporta como modal. En escritorio el fondo sigue usable. */
const CELULAR = '(max-width: 1023px)';

const pila = crearPila();
let escuchandoEscape = false;
const alTeclear = (ev: KeyboardEvent) => {
  if (ev.key !== 'Escape' || pila.abiertos() === 0) return;
  ev.preventDefault();
  pila.escape();
};

/** Solo el panel de encima responde a Escape (HG-HAL-001 HAL-13). */
export function useCerrarConEscape(alCerrar: () => void) {
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => {
    const quitar = pila.abrir(() => cerrar.current());
    if (!escuchandoEscape) { document.addEventListener('keydown', alTeclear); escuchandoEscape = true; }
    return quitar;
  }, []);
}

/** Vuelve inerte lo que está al lado del panel, hasta el `body`; devuelve lo que marcó para liberarlo al cerrar. */
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

/** `oculto` deja el panel montado pero invisible: lo escrito no se pierde al cambiar de pestaña (DEF-002). */
export function Panel({ titulo, subtitulo, error, pie, alCerrar, children, ancho = 'normal', oculto = false }: {
  titulo: ComponentChildren; subtitulo?: ComponentChildren; error?: string; pie?: ComponentChildren; alCerrar: () => void; children?: ComponentChildren;
  ancho?: 'normal' | 'detalle' | 'cuenta' | 'entrada'; oculto?: boolean;
}) {
  useCerrarConEscape(alCerrar);
  const tituloId = useId();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (oculto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (!dialog) return;
    const controles = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
      .filter((el) => el.getClientRects().length && !el.hidden);
    controles()[0]?.focus();
    const inertes = window.matchMedia(CELULAR).matches ? inertizarFondo(dialog) : [];
    const atrapar = (ev: KeyboardEvent) => {
      const paneles = [...document.querySelectorAll('[data-panel-contextual]')];
      if (paneles.at(-1) !== dialog || ev.key !== 'Tab' || !window.matchMedia(CELULAR).matches) return;
      const lista = controles(), primero = lista[0], ultimo = lista.at(-1);
      if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo?.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero?.focus(); }
    };
    dialog.addEventListener('keydown', atrapar);
    return () => {
      dialog.removeEventListener('keydown', atrapar);
      for (const el of inertes) el.inert = false;
      if (anterior?.isConnected) anterior.focus();
    };
  }, [oculto]);
  return createPortal((
    <div class={`capa-panel capa-panel--${ancho}`} hidden={oculto}>
      <section ref={ref} data-panel-contextual class={`panel panel--${ancho}`} aria-labelledby={tituloId}>
        <div class="panel__cab">
          <button type="button" class="redondo panel__volver" aria-label="Volver" onClick={alCerrar}><Ico id="atras" clase="ico--s" /></button>
          <div class="titulos"><h2 id={tituloId}>{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
        </div>
        <div class="panel__cuerpo">
          {children}
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
        </div>
        {pie && <div class="panel__pie">{pie}</div>}
      </section>
    </div>
  ), document.body);
}

const MEDIOS: MedioPago[] = ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'];

/** «¿Cómo paga?»: efectivo, Nequi o Bancolombia. */
export function OpcionesMedio({ medio, alElegir }: { medio: MedioPago; alElegir: (m: MedioPago) => void }) {
  return <div class="segmentado">{MEDIOS.map((m) =>
    <button key={m} type="button" class="opcion" aria-pressed={medio === m} onClick={() => alElegir(m)}>{m !== 'EFECTIVO' && <Ico id={m.toLowerCase()} clase="ico--s" />}{textoMedio(m)}</button>)}</div>;
}
