// Todo lo que la pantalla lee del hotel: habitaciones, transferencias por confirmar,
// reglas vigentes, reportes a Migración pendientes y existencias. Se vuelve a pedir
// cuando cambia la sesión o cuando sube `recarga`. Lo que es solo de administración
// no se pide siquiera para recepción, porque la API responde 403 y no tiene sentido.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Habitacion, type Pago, type SesionActual } from '../api.ts';
import type { Reglas } from '../ajustes.ts';
import { marcarFuente, type Existencia, type Fuente, type PendienteMigracion } from '../avisos.ts';
import { mensajeDeError } from '../envio.ts';

export interface DatosHotel {
  habitaciones: Habitacion[];
  porConfirmar: Pago[];
  reglas: Reglas | null;
  migracion: PendienteMigracion[];
  existencias: Existencia[];
  /** El error del mapa, en palabras; la pantalla lo muestra arriba sin desmontar lo que ya se veía. */
  error: string;
  /** Lo que no respondió en la última recarga: mientras falte algo, no se dice «Todo al día» (HAL-07). */
  sinRevisar: Fuente[];
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
  const [sinRevisar, setSinRevisar] = useState<Fuente[]>([]);
  const marcar = (f: Fuente, ok: boolean) => setSinRevisar((xs) => marcarFuente(xs, f, ok));

  useEffect(() => {
    if (!sesion) return;
    api.habitaciones()
      .then((r) => { setHabitaciones(r.items); setError(''); marcar('habitaciones', true); })
      .catch((e) => {
        if (e instanceof ErrorApi && e.estado === 401) { alVencerSesion(); return; }
        setError(mensajeDeError(e));
        marcar('habitaciones', false);
      });
    api.reglas().then((r) => { setReglas(r); marcar('reglas', true); }).catch(() => marcar('reglas', false));
    // Reportes a Migración (TICKET-37): los ven recepción y la administración.
    api.migracionPendientes().then((r) => { setMigracion(r.items); marcar('migracion', true); }).catch(() => marcar('migracion', false));
    if (sesion.usuario.rol === 'ADMINISTRACION') {
      // Existencias (TICKET-21): solo la administración las ve y recibe sus avisos.
      api.existencias().then((r) => { setExistencias(r.items); marcar('existencias', true); }).catch(() => marcar('existencias', false));
      api.pagosPorConfirmar().then((r) => { setPorConfirmar(r.items); marcar('transferencias', true); }).catch(() => marcar('transferencias', false));
    }
  }, [sesion, recarga]);

  return { habitaciones, porConfirmar, reglas, migracion, existencias, error, sinRevisar };
}
