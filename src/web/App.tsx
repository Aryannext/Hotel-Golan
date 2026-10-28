// Raíz de la PWA: inicio de sesión, recibir el turno si está por recibir (TICKET-03), las vistas Habitaciones y Caja,
// «Por confirmar» para la administración y la actualización en vivo (TICKET-05); Historial (TICKET-13), Equipo (TICKET-14) y Ajustes (TICKET-15).
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Habitacion, type Pago, type SesionActual } from './api.ts';
import { Acceso } from './componentes/Acceso.tsx';
import { Mapa } from './componentes/Mapa.tsx';
import { Entrada } from './componentes/Entrada.tsx';
import { RecibirTurno } from './componentes/RecibirTurno.tsx';
import { Caja } from './componentes/Caja.tsx';
import { Historial } from './componentes/Historial.tsx';
import { Equipo } from './componentes/Equipo.tsx';
import { Ajustes, type Seccion } from './componentes/Ajustes.tsx';
import { Campana, Pendientes, useAhora } from './componentes/Avisos.tsx';
import {
  avisosExistencias, avisosMigracion, calcularAvisos, marcarFuente, ordenarAvisos, type Aviso as AvisoPendiente, type Existencia, type Fuente, type PendienteMigracion,
} from './avisos.ts';
import type { Reglas } from './ajustes.ts';
import { PorConfirmar } from './componentes/PorConfirmar.tsx';
import { SolicitudesFactura } from './componentes/SolicitudesFactura.tsx';
import { AccionesRapidas } from './componentes/AccionesRapidas.tsx';
import { ReportarMigracion } from './componentes/ReportarMigracion.tsx';
import { Ficha } from './componentes/Ficha.tsx';
import { PanelEstado } from './componentes/PanelEstado.tsx';
import { Ico } from './componentes/Ico.tsx';
import { avisoEvento, iniciales } from './logica.ts';
import { useEnVivo } from './enVivo.ts';
import { icoTono } from './presentacion.ts';
import { mensajeDeError } from './envio.ts';

type Vista = 'confirmar' | 'mapa' | 'caja' | 'historial' | 'equipo' | 'ajustes';
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
  const [migracion, setMigracion] = useState<PendienteMigracion[]>([]);
  const [reportando, setReportando] = useState<AvisoPendiente | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [vista, setVista] = useState<Vista>('mapa');
  const [reglas, setReglas] = useState<Reglas | null>(null);
  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [ajustesInicial, setAjustesInicial] = useState<Seccion>('tarifas');
  // Lo que no respondió en la última recarga: mientras falte algo, no se dice «Todo al día» (HAL-07).
  const [sinRevisar, setSinRevisar] = useState<Fuente[]>([]);
  const marcar = (f: Fuente, ok: boolean) => setSinRevisar((xs) => marcarFuente(xs, f, ok));
  const ahora = useAhora();
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
      .then((r) => { setHabitaciones(r.items); setError(''); marcar('habitaciones', true); })
      .catch((e) => {
        if (e instanceof ErrorApi && e.estado === 401) { setSesion(null); setMensaje('Su sesión venció. Inicie sesión de nuevo.'); return; }
        setError(mensajeDeError(e));
        marcar('habitaciones', false);
      });
    api.reglas().then((r) => { setReglas(r); marcar('reglas', true); }).catch(() => marcar('reglas', false));
    // Reportes a Migración (TICKET-37): los ven recepción y la administración.
    api.migracionPendientes().then((r) => { setMigracion(r.items); marcar('migracion', true); }).catch(() => marcar('migracion', false));
    // Existencias (TICKET-21): solo la administración las ve y recibe sus avisos.
    if (sesion.usuario.rol === 'ADMINISTRACION') {
      api.existencias().then((r) => { setExistencias(r.items); marcar('existencias', true); }).catch(() => marcar('existencias', false));
      api.pagosPorConfirmar().then((r) => { setPorConfirmar(r.items); marcar('transferencias', true); }).catch(() => marcar('transferencias', false));
    }
  }, [sesion, recarga]);

  // Cualquier evento (o la consulta de respaldo) vuelve a pedir el estado; los de transferencias además avisan.
  useEnVivo(!!sesion, (ev) => {
    setRecarga((n) => n + 1);
    const a = ev && avisoEvento(ev);
    // A la administración le interesa lo nuevo por confirmar; a recepción, si llegó o no.
    if (a && (esAdmin ? ['pago.por_verificar', 'turno.diferencia'].includes(ev.tipo) : ev.tipo !== 'pago.por_verificar')) setAviso(a);
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
    ...(esAdmin ? [['historial', 'Historial', 'calendario'], ['equipo', 'Equipo', 'huespedes'], ['ajustes', 'Ajustes', 'configuracion']] as Array<[Vista, string, string]> : []),
  ];
  // Avisos (TICKET-16): se recalculan con cada evento en vivo (recarga) y cada 30 s (hora actual).
  const avisos = ordenarAvisos([...calcularAvisos(habitaciones, reglas, ahora), ...avisosMigracion(migracion), ...(esAdmin ? avisosExistencias(existencias) : [])]);
  function elegirAviso(a: AvisoPendiente) {
    const h = habitaciones.find((x) => x.numero === a.habitacion);
    if (a.tipo === 'POR_VERIFICAR' && esAdmin) { setVista('confirmar'); return; }
    if (a.tipo === 'EXISTENCIAS') { setAjustesInicial('existencias'); setVista('ajustes'); return; }
    if (a.tipo === 'MIGRACION') { setReportando(a); return; }
    setVista('mapa');
    if (h && (a.tipo === 'POR_REVISAR' || a.tipo === 'LIMPIEZA')) setRevisando(h);
    else if (h) setFicha(h);
  }

  // Lo que se ve debajo de las pestañas: una vista por pestaña; en Habitaciones, el asistente de entrada o el mapa.
  function vistaActual() {
    if (vista === 'confirmar') return <>
      <PorConfirmar pagos={porConfirmar} sinRevisar={sinRevisar.includes('transferencias')} alCambiar={() => setRecarga((n) => n + 1)} />
      {esAdmin && <SolicitudesFactura recarga={recarga} />}
    </>;
    if (vista === 'historial' && esAdmin) return <Historial recarga={recarga} />;
    if (vista === 'equipo' && esAdmin) return <Equipo recarga={recarga} yo={u.id} />;
    if (vista === 'ajustes' && esAdmin) return <Ajustes key={ajustesInicial} inicial={ajustesInicial} alCambiar={() => setRecarga((n) => n + 1)} />;
    if (vista === 'caja') return <Caja recarga={recarga} usuario={u.usuario} esAdmin={esAdmin} alAvisar={(texto) => setAviso({ tono: 'exito', texto })}
      alEntregar={(texto) => { setSesion(null); setAviso(null); setMensaje(texto); }} />;
    // El asistente de entrada va aparte (abajo): sigue montado aunque se cambie de pestaña (DEF-002).
    if (cotizando) return null;
    return <>
      {/* Inicio más simple: lo del día a un toque, los avisos en una línea y enseguida las habitaciones. */}
      <AccionesRapidas alAvisar={(texto, tono = 'exito') => setAviso({ tono, texto })} alCambiar={() => setRecarga((n) => n + 1)} />
      <Pendientes avisos={avisos} sinRevisar={sinRevisar} alElegir={elegirAviso} />
      <Mapa habitaciones={habitaciones} alElegir={(hab) => { setAviso(null); setCotizando(hab); }} alAbrir={setFicha} alRevisar={setRevisando} />
    </>;
  }

  return (
    <div class="app">
      <div class="contenido">
        <header class="barra-sup">
          <svg class="barra-sup__marca" role="img" aria-label="Hotel Golán"><use href="#logo-golan" /></svg>
          <div class="barra-sup__der">
            <Campana avisos={avisos} sinRevisar={sinRevisar} alElegir={elegirAviso} />
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
                {vistas.map(([v, t, ico]) => <button key={v} type="button" class="pestana" role="tab" aria-selected={vista === v}
                  onClick={() => { setVista(v); if (v === 'ajustes') setAjustesInicial('tarifas'); }}><Ico id={ico} clase="ico--s" /> {t}
                  {v === 'confirmar' && porConfirmar.length > 0 && <span class="pestana__cuenta" aria-label={`${porConfirmar.length} por confirmar`}>{porConfirmar.length}</span>}
                </button>)}
              </div>
              {aviso && !cotizando && <div class={`nota nota--${aviso.tono}`} aria-live="polite" style="margin-bottom:16px">
                <Ico id={icoTono(aviso.tono)} clase="ico--s" /><p>{aviso.texto}</p>
                <button type="button" class="enlace nota__cerrar" aria-label="Cerrar aviso" onClick={() => setAviso(null)}><Ico id="cerrar" clase="ico--xs" /></button>
              </div>}
              {/* Si falla una recarga, el aviso va arriba y lo que se estaba haciendo no se desmonta (UI-01). */}
              {error && vista === 'mapa' && <div class="nota" role="alert" style="margin-bottom:16px"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
              {vistaActual()}
              {cotizando && <div hidden={vista !== 'mapa'}>
                <Entrada key={cotizando.numero} habitacion={cotizando} reglas={reglas} alVolver={() => setCotizando(null)} alRegistrar={(est) => {
                  setCotizando(null);
                  setRecarga((n) => n + 1);
                  setAviso({ tono: 'exito', texto: `Entrada registrada en la habitación ${est.habitacion_numero}: ${est.huesped.nombre_mostrado}.` });
                }} />
              </div>}
              {ficha && <Ficha habitacion={ficha} recarga={recarga} reglas={reglas} esAdmin={esAdmin} alCerrar={() => setFicha(null)} alCambiar={() => setRecarga((n) => n + 1)}
                alSalir={(texto) => { setFicha(null); setRecarga((n) => n + 1); setAviso({ tono: 'exito', texto }); }} />}
              {revisando && <PanelEstado habitacion={revisando} alCerrar={() => setRevisando(null)}
                alCambiar={(texto) => { setRevisando(null); setRecarga((n) => n + 1); setAviso({ tono: texto.includes('Recuerde') ? 'info' : 'exito', texto }); }} />}
              {reportando?.estadiaId && reportando.reporte && <ReportarMigracion estadiaId={reportando.estadiaId} tipo={reportando.reporte}
                alCerrar={() => setReportando(null)} alReportar={() => {
                  setReportando(null);
                  setRecarga((n) => n + 1);
                  setAviso({ tono: 'exito', texto: `Quedó anotado el reporte a Migración de la habitación ${reportando.habitacion}.` });
                }} />}
            </>}
        </main>
      </div>
    </div>
  );
}
