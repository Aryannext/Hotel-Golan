import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { api, ErrorApi, type FotoCompartida } from '../api.ts';

interface Fotos {
  items: Record<string, FotoCompartida>; cargadas: boolean; esAdmin: boolean; error: string;
  guardar: (clave: string, imagen: string, importar?: boolean) => Promise<void>;
  eliminar: (clave: string) => Promise<void>;
}
const noDisponible = async () => { throw new Error('Las fotografías compartidas no están disponibles. Recarga e intenta de nuevo.'); };
const Contexto = createContext<Fotos>({ items: {}, cargadas: false, esAdmin: false, error: '', guardar: noDisponible, eliminar: noDisponible });
export const useFotosCompartidas = () => useContext(Contexto);

export function FotosCompartidas({ esAdmin, recarga, children }: { esAdmin: boolean; recarga: number; children: ComponentChildren }) {
  const [items, setItems] = useState<Record<string, FotoCompartida>>({});
  const [cargadas, setCargadas] = useState(false), [error, setError] = useState('');
  const secuencia = useRef(0), viva = useRef(true);
  const importaciones = useRef(new Map<string, Promise<void>>());
  useEffect(() => () => { viva.current = false; secuencia.current++; }, []);
  const cargar = useCallback(async () => {
    const n = ++secuencia.current;
    try {
      const fotos = await api.fotos();
      if (viva.current && n === secuencia.current) { setItems(Object.fromEntries(fotos.map(f => [f.clave, f]))); setCargadas(true); setError(''); }
    } catch { if (viva.current && n === secuencia.current) setError('No se pudieron cargar las fotos compartidas. Revisa la conexión y vuelve a intentar.'); }
  }, []);
  useEffect(() => { void cargar(); }, [recarga, cargar]);
  useEffect(() => {
    const enfocar = () => { if (document.visibilityState === 'visible') void cargar(); };
    window.addEventListener('focus', enfocar); document.addEventListener('visibilitychange', enfocar);
    return () => { window.removeEventListener('focus', enfocar); document.removeEventListener('visibilitychange', enfocar); };
  }, [cargar]);
  function actualizar(foto: FotoCompartida) {
    secuencia.current++;
    if (viva.current) setItems(antes => ({ ...antes, [foto.clave]: foto }));
  }
  async function guardar(clave: string, imagen: string, importar = false) {
    if (!esAdmin) throw new Error('Solo Administración puede cambiar las fotografías.');
    const ejecutar = async () => {
      try { actualizar(await api.guardarFoto(clave, imagen, importar)); }
      catch (e) {
        if (importar && e instanceof ErrorApi && e.estado === 412) { await cargar(); return; }
        throw e;
      }
    };
    if (!importar) return ejecutar();
    if (!importaciones.current.has(clave)) importaciones.current.set(clave, ejecutar());
    return importaciones.current.get(clave)!;
  }
  async function eliminar(clave: string) {
    if (!esAdmin) throw new Error('Solo Administración puede cambiar las fotografías.');
    actualizar(await api.eliminarFoto(clave));
  }
  return <Contexto.Provider value={{ items, cargadas, esAdmin, error, guardar, eliminar }}>{children}</Contexto.Provider>;
}
