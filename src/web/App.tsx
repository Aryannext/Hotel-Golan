// Raíz de la PWA: arma las piezas y reparte lo que cada pantalla necesita.
// El estado no vive aquí: cada responsabilidad tiene su hook en `hooks/` —
// quién entró (useSesion), qué se lee del hotel (useDatosHotel), cuándo se vuelve
// a pedir (useRecarga), dónde está la pantalla (useNavegacion), qué hay abierto
// encima (usePaneles) y el aviso de una línea (useAviso).
import { Acceso } from './componentes/Acceso.tsx';
import { Mapa } from './componentes/Mapa.tsx';
import { Entrada } from './componentes/Entrada.tsx';
import { RecibirTurno } from './componentes/RecibirTurno.tsx';
import { Caja } from './componentes/Caja.tsx';
import { Historial } from './componentes/Historial.tsx';
import { Equipo } from './componentes/Equipo.tsx';
import { Ajustes } from './componentes/Ajustes.tsx';
import { Campana, useAhora } from './componentes/Avisos.tsx';
import { avisosExistencias, avisosMigracion, calcularAvisos, ordenarAvisos, type Aviso as AvisoPendiente } from './avisos.ts';
import { PorConfirmar } from './componentes/PorConfirmar.tsx';
import { SolicitudesFactura } from './componentes/SolicitudesFactura.tsx';
import { QuienesHoy } from './componentes/QuienesHoy.tsx';
import { ReportarMigracion } from './componentes/ReportarMigracion.tsx';
import { Ficha } from './componentes/Ficha.tsx';
import { PanelEstado } from './componentes/PanelEstado.tsx';
import { Ico } from './componentes/Ico.tsx';
import { Inicio } from './componentes/Inicio.tsx';
import { Lateral } from './componentes/Lateral.tsx';
import { iniciales } from './logica.ts';
import { icoTono } from './presentacion.ts';
import { useSesion } from './hooks/useSesion.ts';
import { useAviso } from './hooks/useAviso.ts';
import { useRecarga } from './hooks/useRecarga.ts';
import { useDatosHotel } from './hooks/useDatosHotel.ts';
import { useNavegacion, type Vista } from './hooks/useNavegacion.ts';
import { usePaneles } from './hooks/usePaneles.ts';

export function App() {
  const ses = useSesion();
  const av = useAviso();
  const rec = useRecarga(!!ses.sesion, ses.esAdmin, av.mostrar);
  const datos = useDatosHotel(ses.sesion, rec.recarga, ses.vencida);
  const nav = useNavegacion(ses.sesion?.usuario.id);
  const pan = usePaneles();
  const ahora = useAhora();
  const { sesion, esAdmin } = ses;

  async function salir() {
    await ses.cerrar();
    pan.cerrarTodo();
    av.limpiar();
  }

  // Cambiar de vista no debe dejar el asistente de entrada a medias detrás.
  function irA(v: Vista) {
    nav.irA(v);
    pan.cotizar(null);
  }

  if (sesion === undefined) return null;
  if (!sesion) return <div id="acceso"><Acceso mensaje={ses.mensaje} alEntrar={ses.entrar} /></div>;

  const u = sesion.usuario;
  const vistas: Array<[Vista, string, string]> = [
    ['inicio', 'Inicio', 'inicio'],
    ['mapa', 'Habitaciones', 'habitaciones'],
    // El nombre del menú es el de la vista que abre: pagos por confirmar, no reservas.
    ...(esAdmin ? [['confirmar', 'Por confirmar', 'reservas'] as [Vista, string, string]] : []),
    ['caja', 'Caja', 'caja'],
    ...(esAdmin ? [
      ['historial', 'Reportes', 'reportes'],
      ['equipo', 'Usuarios', 'usuarios'],
      ['ajustes', 'Configuración', 'configuracion'],
    ] as Array<[Vista, string, string]> : []),
  ];
  // Avisos (TICKET-16): se recalculan con cada evento en vivo (recarga) y cada 30 s (hora actual).
  const avisos = ordenarAvisos([...calcularAvisos(datos.habitaciones, datos.reglas, ahora), ...avisosMigracion(datos.migracion), ...(esAdmin ? avisosExistencias(datos.existencias) : [])]);
  function elegirAviso(a: AvisoPendiente) {
    const h = datos.habitaciones.find((x) => x.numero === a.habitacion);
    pan.cotizar(null);
    if (a.tipo === 'POR_VERIFICAR' && esAdmin) { nav.irA('confirmar'); return; }
    if (a.tipo === 'EXISTENCIAS') { nav.abrirAjustes('existencias'); return; }
    if (a.tipo === 'MIGRACION') { pan.reportar(a); return; }
    nav.irA('mapa');
    if (h && (a.tipo === 'POR_REVISAR' || a.tipo === 'LIMPIEZA')) pan.revisar(h);
    else if (h) pan.abrirFicha(h);
  }

  // Lo que se ve debajo de las pestañas: una vista por pestaña; en Habitaciones, el asistente de entrada o el mapa.
  function vistaActual() {
    if (nav.vista === 'inicio') return <Inicio habitaciones={datos.habitaciones} porConfirmar={datos.porConfirmar} esAdmin={esAdmin} recarga={rec.recarga} alIrA={irA} />;
    if (nav.vista === 'confirmar') return <>
      <PorConfirmar pagos={datos.porConfirmar} alCambiar={rec.recargar} />
      {esAdmin && <SolicitudesFactura recarga={rec.recarga} />}
    </>;
    if (nav.vista === 'historial' && esAdmin) return <Historial recarga={rec.recarga} />;
    if (nav.vista === 'equipo' && esAdmin) return <Equipo recarga={rec.recarga} yo={u.id} />;
    if (nav.vista === 'ajustes' && esAdmin) return <Ajustes key={nav.ajustesInicial} inicial={nav.ajustesInicial} alCambiar={rec.recargar} />;
    if (nav.vista === 'caja') return <Caja recarga={rec.recarga} usuario={u.usuario} esAdmin={esAdmin} alAvisar={av.exito}
      alEntregar={(texto) => { ses.terminar(texto); av.limpiar(); }} />;
    if (datos.error) return <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{datos.error}</p></div>;
    if (pan.cotizando) return <Entrada habitacion={pan.cotizando} reglas={datos.reglas} alVolver={() => pan.cotizar(null)} alRegistrar={(est) => {
      pan.cotizar(null);
      rec.recargar();
      av.exito(`Entrada registrada en la habitación ${est.habitacion_numero}: ${est.huesped.nombre_mostrado}.`);
    }} />;
    return <>
      <div class="acciones-mapa"><button type="button" class="btn btn--secundario" onClick={() => pan.verHoy(true)}><Ico id="huespedes" clase="ico--s" />Quiénes se quedan hoy</button></div>
      {pan.viendoHoy && <QuienesHoy alCerrar={() => pan.verHoy(false)} />}
      <Mapa habitaciones={datos.habitaciones} alElegir={(hab) => { av.limpiar(); pan.cotizar(hab); }} alAbrir={pan.abrirFicha} alRevisar={pan.revisar} />
    </>;
  }

  const fechaActual = new Date(ahora);
  const diaTexto = fechaActual.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const fechaFormateada = diaTexto.charAt(0).toUpperCase() + diaTexto.slice(1);
  const horaFormateada = fechaActual.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div class="app">
      <Lateral opciones={vistas.map(([v, t, ico]) => ({ vista: v, texto: t, ico, cuenta: v === 'confirmar' ? datos.porConfirmar.length : undefined }))}
        vista={nav.vista} alElegir={irA}
        nombre={u.nombre} iniciales={iniciales(u.nombre)} rol={esAdmin ? 'Administración' : 'Recepción'} alSalir={salir} />
      <div class="contenido">
        <header class="barra-sup">
          <svg class="barra-sup__marca" role="img" aria-label="Hotel Golán"><use href="#logo-golan" /></svg>
          <div class="barra-sup__der">
            <Campana avisos={avisos} alElegir={elegirAviso} />
            <div class="barra-sup__reloj" aria-live="off">
              <span class="reloj__fecha">{fechaFormateada}</span>
              <strong class="reloj__hora">{horaFormateada}</strong>
            </div>
            <span class="barra-sup__usuario" title={u.nombre}>
              <span class="barra-sup__iniciales" aria-hidden="true">{iniciales(u.nombre)}</span>
              <span class="barra-sup__nombre">{u.nombre} · {esAdmin ? 'Administración' : 'Recepción'}</span>
            </span>
            <button type="button" class="btn btn--secundario barra-sup__salir" onClick={salir}><Ico id="salida" clase="ico--s" />Cerrar sesión</button>
          </div>
        </header>
        <main class="vista" id="vista" tabIndex={-1}>
          {sesion.turno_por_recibir ? <RecibirTurno alRecibir={() => { ses.recibirTurno(); nav.irA('caja'); }} />
            : <>
              <div class="pestanas" role="tablist" style="margin-bottom:16px">
                {vistas.map(([v, t, ico]) => <button key={v} type="button" class="pestana" role="tab" aria-selected={nav.vista === v}
                  onClick={() => { irA(v); if (v === 'ajustes') nav.abrirAjustes('tarifas'); }}><Ico id={ico} clase="ico--s" /> {t}
                  {v === 'confirmar' && datos.porConfirmar.length > 0 && <span class="pestana__cuenta" aria-label={`${datos.porConfirmar.length} por confirmar`}>{datos.porConfirmar.length}</span>}
                </button>)}
              </div>
              {av.aviso && !pan.cotizando && <div class={`nota nota--${av.aviso.tono}`} aria-live="polite" style="margin-bottom:16px">
                <Ico id={icoTono(av.aviso.tono)} clase="ico--s" /><p>{av.aviso.texto}</p>
                <button type="button" class="enlace nota__cerrar" aria-label="Cerrar aviso" onClick={av.limpiar}><Ico id="cerrar" clase="ico--xs" /></button>
              </div>}
              {vistaActual()}
              {pan.ficha && <Ficha habitacion={pan.ficha} recarga={rec.recarga} reglas={datos.reglas} esAdmin={esAdmin} alCerrar={() => pan.abrirFicha(null)} alCambiar={rec.recargar}
                alSalir={(texto) => { pan.abrirFicha(null); rec.recargar(); av.exito(texto); }} />}
              {pan.revisando && <PanelEstado habitacion={pan.revisando} alCerrar={() => pan.revisar(null)}
                alCambiar={(texto) => { pan.revisar(null); rec.recargar(); av.mostrar({ tono: texto.includes('Recuerde') ? 'info' : 'exito', texto }); }} />}
              {pan.reportando?.estadiaId && pan.reportando.reporte && <ReportarMigracion estadiaId={pan.reportando.estadiaId} tipo={pan.reportando.reporte}
                alCerrar={() => pan.reportar(null)} alReportar={() => {
                  const habitacion = pan.reportando?.habitacion;
                  pan.reportar(null);
                  rec.recargar();
                  av.exito(`Quedó anotado el reporte a Migración de la habitación ${habitacion}.`);
                }} />}
            </>}
        </main>
      </div>
    </div>
  );
}
