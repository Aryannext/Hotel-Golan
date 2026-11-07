import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { eliminarFotoHabitacion, FOTO_DEFECTO, obtenerFotoHabitacion, procesarArchivoFoto } from '../fotosHabitacion.ts';
import { Ico } from './Ico.tsx';
import { CamaraFoto } from './CamaraFoto.tsx';
import { useFotosCompartidas } from './FotosCompartidas.tsx';
interface FotoHabitacionProps { numero: string; estado?: string; claseEstado?: string; textoEstado?: string; altura?: number | string; editable?: boolean; control?: 'camara' | 'agregar'; etiqueta?: string; vacio?: boolean; fotoInicial?: string }

function OpcionesFoto({ descripcion, alCerrar, alSubir, alTomar, alEliminar }: { descripcion: string; alCerrar: () => void; alSubir: () => void; alTomar: () => void; alEliminar?: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const cerrarRef = useRef(alCerrar);
  useEffect(() => { cerrarRef.current = alCerrar; });
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    d.showModal();
    // Escape lo maneja el propio <dialog>: no debe llegar a la pila de paneles y cerrar también el de atrás.
    const tecla = (ev: KeyboardEvent) => ev.stopPropagation();
    // Un clic en el fondo (el propio <dialog>, fuera del contenido) lo cierra.
    const clic = (ev: MouseEvent) => { if (ev.target === d) cerrarRef.current(); };
    d.addEventListener('keydown', tecla);
    d.addEventListener('click', clic);
    return () => { d.removeEventListener('keydown', tecla); d.removeEventListener('click', clic); };
  }, []);
  return createPortal(<dialog ref={dialogo} class="foto-selector" aria-label={`Cambiar foto de ${descripcion}`} onClose={alCerrar}>
    <button type="button" class="foto-selector__cerrar" aria-label="Cerrar opciones de foto" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
    <h2>¿Cómo quieres agregar la foto?</h2><p>{descripcion}</p>
    <div class="foto-selector__opciones">
      <button type="button" class="btn btn--primario" onClick={() => { dialogo.current?.close(); alSubir(); }}><Ico id="sube" clase="ico--s" />Subir foto</button>
      <button type="button" class="btn btn--secundario" onClick={() => { dialogo.current?.close(); alTomar(); }}><Ico id="camara" clase="ico--s" />Tomar foto</button>
    </div>
    <p class="ayuda">JPG, PNG o WebP · Hasta 5 MB y 20 MP. La foto se comparte con los equipos conectados al servidor del hotel. Solo Administración puede cambiarla.</p>
    {alEliminar && <button type="button" class="enlace foto-selector__eliminar" onClick={alEliminar}><Ico id="papelera" clase="ico--xs" />Eliminar foto actual</button>}
  </dialog>, document.body);
}

export function FotoHabitacion({ numero, claseEstado, textoEstado, altura, editable = true, control = 'camara', etiqueta, vacio = false, fotoInicial }: FotoHabitacionProps) {
  const descripcion = etiqueta ?? `habitación ${numero}`;
  const fotos = useFotosCompartidas();
  const { esAdmin: fotosAdmin, cargadas: fotosCargadas, guardar: guardarCompartida } = fotos;
  const registro = fotos.items[numero];
  const imagen = registro?.tiene_foto ? `/api/v1/fotos/${encodeURIComponent(numero)}?v=${registro.version}` : fotoInicial || FOTO_DEFECTO;
  const puedeEditar = editable && fotos.esAdmin;
  const [cargando, setCargando] = useState(false), [error, setError] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const archivo = useRef<HTMLInputElement>(null), camara = useRef<HTMLInputElement>(null), vigente = useRef(numero);
  const importada = useRef(new Set<string>());
  vigente.current = numero;
  useEffect(() => {
    setError('');
  }, [numero]);
  useEffect(() => {
    if (!fotosAdmin || !fotosCargadas || registro || importada.current.has(numero)) return;
    const local = obtenerFotoHabitacion(numero);
    if (local === FOTO_DEFECTO) return;
    importada.current.add(numero); setCargando(true);
    guardarCompartida(numero, local, true).then(() => {
      try { eliminarFotoHabitacion(numero); } catch { /* La copia compartida prevalece. */ }
    }).catch(() => { if (vigente.current === numero) setError('No se pudo compartir la foto guardada en este navegador. Conservamos el original local; vuelve a subirla para reintentar.'); })
      .finally(() => { if (vigente.current === numero) setCargando(false); });
  }, [numero, fotosAdmin, fotosCargadas, registro, guardarCompartida]);
  async function seleccionar(ev: Event) {
    const input = ev.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
    try { await guardar(file); } catch { /* El error ya queda visible en el editor. */ }
    finally { input.value = ''; }
  }
  async function guardar(file: File) {
    if (!puedeEditar) return;
    const elegida = numero; setCargando(true); setError('');
    try { const dataUrl = await procesarArchivoFoto(file); await fotos.guardar(elegida, dataUrl); try { eliminarFotoHabitacion(elegida); } catch { /* La foto compartida ya está guardada. */ } }
    catch (e) { if (vigente.current === elegida) setError(e instanceof Error ? e.message : 'No se pudo preparar la foto.'); throw e; }
    finally { setCargando(false); }
  }
  async function eliminar() {
    if (!puedeEditar || cargando) return;
    setError(''); setCargando(true);
    try { await fotos.eliminar(numero); try { eliminarFotoHabitacion(numero); } catch { /* La marca de borrado compartida prevalece. */ } }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar.'); }
    finally { setCargando(false); }
  }
  return <div class={`foto-hab-editor foto-hab-editor--${control}`}>
    <div class="foto-hab-contenedor" style={altura ? { height: typeof altura === 'number' ? `${altura}px` : altura } : undefined}>
      {vacio && imagen === FOTO_DEFECTO ? <div class="foto-producto-vacia"><Ico id="vitrina" clase="ico--l" /><span>{puedeEditar ? 'Agregar foto' : 'Sin foto'}</span></div> : <img src={imagen} alt={imagen === FOTO_DEFECTO ? 'Fotografía de ejemplo · Demo' : `Fotografía de ${descripcion}`} class="foto-hab-img" />}
      {textoEstado && <span class={`foto-hab-badge foto-hab-badge--${claseEstado ?? 'neutro'}`}><span class="foto-hab-badge__punto" />{textoEstado}</span>}
      {puedeEditar && control === 'camara' && <button type="button" class="foto-hab-elegir foto-hab-elegir--camara" aria-label={`Cambiar foto de ${descripcion}`} disabled={cargando || !fotos.cargadas} onClick={() => setAbierto(true)}><Ico id="camara" clase="ico--s" /></button>}
    </div>
    {puedeEditar && <>
      {control === 'agregar' && <button type="button" class="foto-hab-elegir foto-hab-elegir--agregar" aria-label={`Agregar foto de habitación ${numero}`} disabled={cargando || !fotos.cargadas} onClick={() => setAbierto(true)}><Ico id="mas" clase="ico--l" /></button>}
      <input type="file" ref={archivo} accept="image/*" hidden onChange={seleccionar} />
      <input type="file" ref={camara} accept="image/*" capture="environment" hidden onChange={seleccionar} />
      {cargando && <p class="ayuda" role="status">Compartiendo foto…</p>}
      {fotos.error && <p class="foto-hab-error" role="alert">{fotos.error}</p>}
      {error && <p class="foto-hab-error" role="alert">{error}</p>}
      {abierto && <OpcionesFoto descripcion={descripcion} alCerrar={() => setAbierto(false)} alSubir={() => { archivo.current?.click(); setAbierto(false); }} alTomar={() => { setAbierto(false); if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) camara.current?.click(); else setCamaraAbierta(true); }} alEliminar={registro?.tiene_foto ? () => { void eliminar(); setAbierto(false); } : undefined} />}
      {camaraAbierta && <CamaraFoto descripcion={descripcion} alCerrar={() => setCamaraAbierta(false)} alCapturar={guardar} alArchivo={() => { setCamaraAbierta(false); archivo.current?.click(); }} />}
    </>}
  </div>;
}
