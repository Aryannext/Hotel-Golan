// Raíz de la PWA: decide entre inicio de sesión y la aplicación; muestra el mapa (TICKET-01).
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Habitacion, type SesionActual } from './api.ts';
import { Acceso } from './componentes/Acceso.tsx';
import { Mapa } from './componentes/Mapa.tsx';
import { Cotizar } from './componentes/Cotizar.tsx';
import { Ico } from './componentes/Ico.tsx';
import { iniciales } from './logica.ts';

export function App() {
  const [sesion, setSesion] = useState<SesionActual | null | undefined>(undefined);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [mensaje, setMensaje] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [cotizando, setCotizando] = useState<Habitacion | null>(null);

  useEffect(() => {
    api.sesionActual().then(setSesion).catch(() => setSesion(null));
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sin-sesion', !sesion);
    if (!sesion) return;
    api.habitaciones()
      .then((r) => { setHabitaciones(r.items); setError(''); })
      .catch((e) => {
        if (e instanceof ErrorApi && e.estado === 401) { setSesion(null); setMensaje('Su sesión venció. Inicie sesión de nuevo.'); }
        else setError(e instanceof Error ? e.message : 'No se pudo cargar el mapa.');
      });
  }, [sesion]);

  async function salir() {
    await api.cerrarSesion().catch(() => undefined);
    setSesion(null);
    setMensaje('Sesión cerrada.');
  }

  if (sesion === undefined) return null;
  if (!sesion) return <div id="acceso"><Acceso mensaje={mensaje} alEntrar={(s) => { setMensaje(undefined); setSesion(s); }} /></div>;

  const u = sesion.usuario;
  return (
    <div class="app">
      <div class="contenido">
        <header class="barra-sup">
          <svg class="barra-sup__marca" role="img" aria-label="Hotel Golán"><use href="#logo-golan" /></svg>
          <div class="barra-sup__der">
            <span class="barra-sup__usuario" title={u.nombre}>
              <span class="barra-sup__iniciales" aria-hidden="true">{iniciales(u.nombre)}</span>
              <span class="barra-sup__nombre">{u.nombre} · {u.rol === 'ADMINISTRACION' ? 'Administración' : 'Recepción'}</span>
            </span>
            <button type="button" class="btn btn--secundario" onClick={salir}><Ico id="salida" clase="ico--s" />Cerrar sesión</button>
          </div>
        </header>
        <main class="vista" id="vista" tabIndex={-1}>
          {error ? <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>
            : cotizando ? <Cotizar habitacion={cotizando} alVolver={() => setCotizando(null)} />
            : <Mapa habitaciones={habitaciones} alElegir={setCotizando} />}
        </main>
      </div>
    </div>
  );
}
