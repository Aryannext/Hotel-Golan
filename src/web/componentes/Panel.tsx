// Columna contextual común: junto al contenido en escritorio; completa en móvil.
// También los ganchos de los paneles: cerrar con Escape y enviar una acción mostrando el error en palabras.
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { ErrorApi, type MedioPago } from '../api.ts';
import { textoMedio } from '../logica.ts';
import { Ico } from './Ico.tsx';

const SIN_CONEXION = 'No se pudo conectar con el sistema. Intente de nuevo: no se duplicará.';

const abiertos: symbol[] = [];
/** Solo el contexto superior responde a Escape; el fondo sigue utilizable. */
export function useCerrarConEscape(alCerrar: () => void) {
  const cerrar = useRef(alCerrar);
  cerrar.current = alCerrar;
  useEffect(() => {
    const identidad = Symbol();
    abiertos.push(identidad);
    const escape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && abiertos.at(-1) === identidad) {
        ev.preventDefault(); cerrar.current();
      }
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      const indice = abiertos.indexOf(identidad);
      if (indice >= 0) abiertos.splice(indice, 1);
    };
  }, []);
}

/** Envía una acción una sola vez a la vez; si falla, deja el mensaje de la API (o el de sin conexión) en `error`. */
export function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar(accion: () => Promise<void>) {
    setEnviando(true);
    setError('');
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : SIN_CONEXION);
    } finally {
      setEnviando(false);
    }
  }
  return { enviando, error, setError, enviar };
}

export function Panel({ titulo, subtitulo, error, pie, alCerrar, children, ancho = 'normal' }: {
  titulo: ComponentChildren; subtitulo?: ComponentChildren; error?: string; pie?: ComponentChildren; alCerrar: () => void; children?: ComponentChildren; ancho?: 'normal' | 'detalle' | 'cuenta' | 'entrada';
}) {
  useCerrarConEscape(alCerrar);
  const tituloId = useId();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (!dialog) return;
    const controles = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
      .filter((el) => el.getClientRects().length && !el.hidden);
    controles()[0]?.focus();
    const atrapar = (ev: KeyboardEvent) => {
      const paneles = [...document.querySelectorAll('[data-panel-contextual]')];
      if (paneles.at(-1) !== dialog || ev.key !== 'Tab' || !window.matchMedia('(max-width: 1023px)').matches) return;
      const lista = controles(), primero = lista[0], ultimo = lista.at(-1);
      if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo?.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero?.focus(); }
    };
    dialog.addEventListener('keydown', atrapar);
    return () => { dialog.removeEventListener('keydown', atrapar); if (anterior?.isConnected) anterior.focus(); };
  }, []);
  return createPortal((
    <div class={`capa-panel capa-panel--${ancho}`}>
      <section ref={ref} data-panel-contextual class={`panel panel--${ancho}`} role="region" aria-labelledby={tituloId}>
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
