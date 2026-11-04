import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Ico } from './Ico.tsx';

/** Cámara de escritorio/tablet. En teléfonos se conserva la captura nativa. */
export function CamaraFoto({ descripcion, alCerrar, alCapturar, alArchivo }: {
  descripcion: string; alCerrar: () => void; alCapturar: (foto: File) => Promise<void>; alArchivo: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null), video = useRef<HTMLVideoElement>(null);
  const [lista, setLista] = useState(false), [error, setError] = useState(''), [guardando, setGuardando] = useState(false);
  useEffect(() => {
    let cerrada = false, stream: MediaStream | undefined;
    dialogo.current?.showModal();
    async function iniciar() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('CONTEXTO');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (cerrada) { stream.getTracks().forEach(t => t.stop()); return; }
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
      } catch (e) {
        if (cerrada) return;
        const nombre = e instanceof Error ? e.name : '';
        setError(nombre === 'NotAllowedError' ? 'Permite el acceso a la cámara en los permisos del navegador y vuelve a intentarlo.'
          : nombre === 'NotFoundError' ? 'No se encontró una cámara en este equipo. Puedes subir una foto.'
          : nombre === 'NotReadableError' ? 'La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentarlo.'
          : !window.isSecureContext ? 'Para abrir la cámara desde otro equipo se necesita una dirección HTTPS. Puedes subir una foto mientras se configura.'
          : 'No se pudo abrir la cámara. Revisa sus permisos o sube una foto.');
      }
    }
    void iniciar();
    return () => { cerrada = true; stream?.getTracks().forEach(t => t.stop()); };
  }, []);
  async function capturar() {
    const v = video.current;
    if (!v?.videoWidth || !v.videoHeight || guardando) return;
    setGuardando(true); setError('');
    try {
      const canvas = document.createElement('canvas');
      const escala = Math.min(1, 1200 / Math.max(v.videoWidth, v.videoHeight));
      canvas.width = Math.round(v.videoWidth * escala); canvas.height = Math.round(v.videoHeight * escala);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar la fotografía.');
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo capturar la fotografía.')), 'image/jpeg', .85));
      await alCapturar(new File([blob], 'foto-camara.jpg', { type: 'image/jpeg' }));
      alCerrar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la foto.'); }
    finally { setGuardando(false); }
  }
  return createPortal(<dialog ref={dialogo} class="foto-selector foto-camara" aria-label={`Tomar foto de ${descripcion}`} onClose={alCerrar} onKeyDown={e => e.stopPropagation()}>
    <button type="button" class="foto-selector__cerrar" aria-label="Cerrar cámara" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
    <h2>Tomar foto</h2><p>{descripcion}</p>
    <video ref={video} autoPlay muted playsInline onLoadedData={() => setLista(true)} />
    {error && <p class="foto-hab-error" role="alert">{error}</p>}
    {!lista && !error && <p role="status">Abriendo la cámara… Si el navegador solicita permiso, elige «Permitir».</p>}
    <div class="foto-selector__opciones">
      <button type="button" class="btn btn--primario" disabled={!lista || guardando} onClick={() => void capturar()}><Ico id="camara" clase="ico--s" />{guardando ? 'Guardando…' : 'Capturar foto'}</button>
      <button type="button" class="btn btn--secundario" onClick={() => { dialogo.current?.close(); alArchivo(); }}>Subir foto</button>
    </div>
  </dialog>, document.body);
}
