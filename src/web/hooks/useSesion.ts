// Quién tiene el turno abierto. Reúne todo lo que depende de la sesión y de nada más:
// preguntarla al cargar, el mensaje que verá la pantalla de acceso al volver a ella
// («Sesión cerrada», «Su sesión venció») y la clase del body que hace que el acceso
// ocupe toda la pantalla. Antes esto vivía suelto en App.tsx entre otros quince estados.
import { useEffect, useState } from 'preact/hooks';
import { api, type SesionActual } from '../api.ts';

export interface Sesion {
  /** `undefined` mientras se pregunta al servidor; `null` cuando no hay sesión. */
  sesion: SesionActual | null | undefined;
  esAdmin: boolean;
  /** Lo que lee la pantalla de acceso al volver a ella; se borra al entrar. */
  mensaje: string | undefined;
  entrar: (s: SesionActual) => void;
  /** Cierra la sesión en el servidor y vuelve al acceso. */
  cerrar: () => Promise<void>;
  /** Termina la sesión con un texto propio: al entregar el turno. */
  terminar: (texto: string) => void;
  /** La API respondió 401: la sesión se venció sola. */
  vencida: () => void;
  /** El turno quedó recibido (TICKET-03): ya no hay que pedirlo otra vez. */
  recibirTurno: () => void;
}

export function useSesion(): Sesion {
  const [sesion, setSesion] = useState<SesionActual | null | undefined>(undefined);
  const [mensaje, setMensaje] = useState<string | undefined>();

  useEffect(() => {
    api.sesionActual().then(setSesion).catch(() => setSesion(null));
  }, []);

  // Sin sesión el acceso ocupa toda la pantalla, sin barra lateral ni barra superior.
  useEffect(() => { document.body.classList.toggle('sin-sesion', !sesion); }, [sesion]);

  return {
    sesion,
    esAdmin: sesion?.usuario.rol === 'ADMINISTRACION',
    mensaje,
    entrar: (s) => { setMensaje(undefined); setSesion(s); },
    cerrar: async () => {
      await api.cerrarSesion().catch(() => undefined);
      setSesion(null);
      setMensaje('Sesión cerrada.');
    },
    terminar: (texto) => { setSesion(null); setMensaje(texto); },
    vencida: () => { setSesion(null); setMensaje('Su sesión venció. Inicie sesión de nuevo.'); },
    recibirTurno: () => setSesion((s) => (s ? { ...s, turno_por_recibir: false } : s)),
  };
}
