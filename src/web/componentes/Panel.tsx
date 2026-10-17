// Panel lateral (abajo en el celular) común: velo, <dialog>, encabezado con «Cerrar», cuerpo con el error y pie.
// También los ganchos de los paneles: cerrar con Escape y enviar una acción mostrando el error en palabras.
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { ErrorApi, type MedioPago } from '../api.ts';
import { textoMedio } from '../logica.ts';
import { Ico } from './Ico.tsx';

const SIN_CONEXION = 'No se pudo conectar con el sistema. Intente de nuevo: no se duplicará.';

/** Escape cierra el panel y la página de atrás no se desplaza mientras está abierto. */
export function useCerrarConEscape(alCerrar: () => void) {
  useEffect(() => {
    const escape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', escape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', escape); document.body.style.overflow = ''; };
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

export function Panel({ titulo, subtitulo, error, pie, alCerrar, children }: {
  titulo: ComponentChildren; subtitulo?: ComponentChildren; error?: string; pie?: ComponentChildren; alCerrar: () => void; children?: ComponentChildren;
}) {
  useCerrarConEscape(alCerrar);
  return (
    <div class="capa-panel">
      <button type="button" class="velo velo--visible" aria-label="Cerrar" tabIndex={-1} onClick={alCerrar} />
      <dialog open class="panel" aria-modal="true" aria-labelledby="panel-titulo">
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label="Cerrar" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
          <div class="titulos"><h2 id="panel-titulo">{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
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
