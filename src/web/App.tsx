// Raíz de la PWA: inicio de sesión, recibir el turno si está por recibir (TICKET-03), las vistas Habitaciones y Caja,
// «Por confirmar» para la administración y la actualización en vivo (TICKET-05).
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Habitacion, type Pago, type SesionActual } from './api.ts';
import { Acceso } from './componentes/Acceso.tsx';
import { Mapa } from './componentes/Mapa.tsx';
import { Entrada } from './componentes/Entrada.tsx';
import { RecibirTurno } from './componentes/RecibirTurno.tsx';
import { Caja } from './componentes/Caja.tsx';
import { PorConfirmar } from './componentes/PorConfirmar.tsx';
import { Ficha } from './componentes/Ficha.tsx';
import { PanelEstado } from './componentes/PanelEstado.tsx';
import { Ico } from './componentes/Ico.tsx';
import { avisoEvento, iniciales } from './logica.ts';
import { useEnVivo } from './enVivo.ts';

type Vista = 'confirmar' | 'mapa' | 'caja';
interface Aviso { tono: 'exito' | 'alerta' | 'info'; texto: string }

export function App() {
  const [sesion, setSesion] = useState<SesionActual | null | undefined>(undefined);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [porConfirmar, setPorConfirmar] = useState<Pago[]>([]);
  const [mensaje, setMensaje] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [cotizando, setCotizando] = useState<Habitacion | null>(null);
  const [ficha, setFicha] = useState<Habitacion | null>(null);
  const [revisando, setRevisando] = useState<Habitacion | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [vista, setVista] = useState<Vista>('mapa');
  const esAdmin = sesion?.usuario.rol === 'ADMINISTRACION';

  useEffect(() => {
    api.sesionActual().then(setSesion).catch(() => setSesion(null));
  }, []);

  // La administración empieza en «Por confirmar»; recepción, en el mapa.
  useEffect(() => { if (sesion) setVista(sesion.usuario.rol === 'ADMINISTRACION' ? 'confirmar' : 'mapa'); }, [sesion?.usuario.id]);

  useEffect(() => {
    document.body.classList.toggle('sin-sesion', !sesion);
    if (!sesion) return;
    api.habitaciones()
      .then((r) => { setHabitaciones(r.items); setError(''); })
      .catch((e) => {
        if (e instanceof ErrorApi && e.estado === 401) { setSesion(null); setMensaje('Su sesión venció. Inicie sesión de nuevo.'); }
        else setError(e instanceof Error ? e.message : 'No se pudo cargar el mapa.');
      });
    if (sesion.usuario.rol === 'ADMINISTRACION') api.pagosPorConfirmar().then((r) => setPorConfirmar(r.items)).catch(() => undefined);
  }, [sesion, recarga]);

  // Cualquier evento (o la consulta de respaldo) vuelve a pedir el estado; los de transferencias además avisan.
  useEnVivo(!!sesion, (ev) => {
    setRecarga((n) => n + 1);
    const a = ev && avisoEvento(ev);
    // A la administración le interesa lo nuevo por confirmar; a recepción, si llegó o no.
    if (a && (esAdmin ? ev.tipo === 'pago.por_verificar' : ev.tipo !== 'pago.por_verificar')) setAviso(a);
  });

  async function salir() {
    await api.cerrarSesion().catch(() => undefined);
    setSesion(null);
    setCotizando(null);
    setFicha(null);
    setRevisando(null);
    setAviso(null);
    setMensaje('Sesión cerrada.');
  }

  if (sesion === undefined) return null;
  if (!sesion) return <div id="acceso"><Acceso mensaje={mensaje} alEntrar={(s) => { setMensaje(undefined); setSesion(s); }} /></div>;

  const u = sesion.usuario;
  const vistas: Array<[Vista, string, string]> = [
    ...(esAdmin ? [['confirmar', 'Por confirmar', 'transferencia'] as [Vista, string, string]] : []),
    ['mapa', 'Habitaciones', 'habitaciones'], ['caja', 'Caja', 'caja'],
  ];
  return (
    <div class="app">
      <div class="contenido">
        <header class="barra-sup">
          <svg class="barra-sup__marca" role="img" aria-label="Hotel Golán"><use href="#logo-golan" /></svg>
          <div class="barra-sup__der">
            <span class="barra-sup__usuario" title={u.nombre}>
              <span class="barra-sup__iniciales" aria-hidden="true">{iniciales(u.nombre)}</span>
              <span class="barra-sup__nombre">{u.nombre} · {esAdmin ? 'Administración' : 'Recepción'}</span>
            </span>
            <button type="button" class="btn btn--secundario" onClick={salir}><Ico id="salida" clase="ico--s" />Cerrar sesión</button>
          </div>
        </header>
        <main class="vista" id="vista" tabIndex={-1}>
          {sesion.turno_por_recibir ? <RecibirTurno alRecibir={() => { setSesion({ ...sesion, turno_por_recibir: false }); setVista('caja'); }} />
            : <>
              <div class="pestanas" role="tablist" style="margin-bottom:16px">
                {vistas.map(([v, t, ico]) => <button type="button" class="pestana" role="tab" aria-selected={vista === v}
                  onClick={() => { setVista(v); setCotizando(null); }}><Ico id={ico} clase="ico--s" /> {t}
                  {v === 'confirmar' && porConfirmar.length > 0 && <span class="pestana__cuenta" aria-label={`${porConfirmar.length} por confirmar`}>{porConfirmar.length}</span>}
                </button>)}
              </div>
              {aviso && !cotizando && <div class={`nota nota--${aviso.tono}`} role="status" style="margin-bottom:16px">
                <Ico id={aviso.tono === 'alerta' ? 'alerta' : aviso.tono === 'exito' ? 'check' : 'info'} clase="ico--s" /><p>{aviso.texto}</p>
                <button type="button" class="enlace nota__cerrar" aria-label="Cerrar aviso" onClick={() => setAviso(null)}><Ico id="cerrar" clase="ico--xs" /></button>
              </div>}
              {vista === 'confirmar' ? <PorConfirmar pagos={porConfirmar} alCambiar={() => setRecarga((n) => n + 1)} />
                : vista === 'caja' ? <Caja recarga={recarga} usuario={u.usuario} alAvisar={(texto) => setAviso({ tono: 'exito', texto })}
                  alEntregar={(texto) => { setSesion(null); setAviso(null); setMensaje(texto); }} />
                : error ? <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>
                : cotizando ? <Entrada habitacion={cotizando} alVolver={() => setCotizando(null)} alRegistrar={(est) => {
                  setCotizando(null);
                  setRecarga((n) => n + 1);
                  setAviso({ tono: 'exito', texto: `Entrada registrada en la habitación ${est.habitacion_numero}: ${est.huesped.nombre_mostrado}.` });
                }} />
                : <Mapa habitaciones={habitaciones} alElegir={(hab) => { setAviso(null); setCotizando(hab); }} alAbrir={setFicha} alRevisar={setRevisando} />}
              {ficha && <Ficha habitacion={ficha} recarga={recarga} alCerrar={() => setFicha(null)} alCambiar={() => setRecarga((n) => n + 1)}
                alSalir={(texto) => { setFicha(null); setRecarga((n) => n + 1); setAviso({ tono: 'exito', texto }); }} />}
              {revisando && <PanelEstado habitacion={revisando} alCerrar={() => setRevisando(null)}
                alCambiar={(texto) => { setRevisando(null); setRecarga((n) => n + 1); setAviso({ tono: texto.includes('Recuerde') ? 'info' : 'exito', texto }); }} />}
            </>}
        </main>
      </div>
    </div>
  );
}
