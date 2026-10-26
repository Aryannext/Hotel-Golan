// Todo lo que la pantalla lee del hotel: habitaciones, transferencias por confirmar,
// reglas vigentes, reportes a Migración pendientes y existencias. Se vuelve a pedir
// cuando cambia la sesión o cuando sube `recarga`. Lo que es solo de administración
// no se pide siquiera para recepción, porque la API responde 403 y no tiene sentido.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Habitacion, type Pago, type SesionActual } from '../api.ts';
import type { Reglas } from '../ajustes.ts';
import type { Existencia, PendienteMigracion } from '../avisos.ts';

export interface DatosHotel {
  habitaciones: Habitacion[];
  porConfirmar: Pago[];
  reglas: Reglas | null;
  migracion: PendienteMigracion[];
  existencias: Existencia[];
  /** Solo el mapa corta la pantalla si falla; lo demás se calla y deja la vista servible. */
  error: string;
}

export function useDatosHotel(
  sesion: SesionActual | null | undefined,
  recarga: number,
  alVencerSesion: () => void,
): DatosHotel {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [porConfirmar, setPorConfirmar] = useState<Pago[]>([]);
  const [reglas, setReglas] = useState<Reglas | null>(null);
  const [migracion, setMigracion] = useState<PendienteMigracion[]>([]);
  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sesion) return;
    api.habitaciones()
      .then((r) => { setHabitaciones(r.items); setError(''); })
      .catch((e) => {
        if (e instanceof ErrorApi && e.estado === 401) alVencerSesion();
        else setError(e instanceof Error ? e.message : 'No se pudo cargar el mapa.');
      });
    api.reglas().then(setReglas).catch(() => undefined);
    // Reportes a Migración (TICKET-37): los ven recepción y la administración.
    api.migracionPendientes().then((r) => setMigracion(r.items)).catch(() => undefined);
    if (sesion.usuario.rol === 'ADMINISTRACION') {
      // Existencias (TICKET-21): solo la administración las ve y recibe sus avisos.
      api.existencias().then((r) => setExistencias(r.items)).catch(() => undefined);
      api.pagosPorConfirmar().then((r) => setPorConfirmar(r.items)).catch(() => undefined);
    }
  }, [sesion, recarga]);

  return { habitaciones, porConfirmar, reglas, migracion, existencias, error };
}
