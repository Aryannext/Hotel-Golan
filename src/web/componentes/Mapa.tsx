// Mapa de las habitaciones con soporte para vista en cuadrícula y lista (Imagen 1).
import { useEffect, useState } from 'preact/hooks';
import { api, type Habitacion } from '../api.ts';
import { claseEstado, contarEstados, filtrarPorGrupo, textoEstado, type FiltroMapa } from '../logica.ts';
import { botonesTarjeta, type AccionTarjeta } from '../presentacion.ts';
import { Panel } from './Panel.tsx';
import { PanelHabitacion } from './PanelHabitacion.tsx';
import { Ico } from './Ico.tsx';
import { FotoHabitacion } from './FotoHabitacion.tsx';
import { franjaEntrada } from '../habitacion.ts';

function TarjetaCuarto({
  h,
  activa,
  alHacer,
}: {
  h: Habitacion;
  activa: boolean;
  alHacer: (accion: AccionTarjeta, h: Habitacion) => void;
}) {
  const e = h.estadia_activa;
  const clase = claseEstado(h.estado);
  const botones = botonesTarjeta(h);
  const [franja, setFranja] = useState<'dia' | 'noche' | null>(null);
  const estadiaId = e?.id;
  useEffect(() => {
    let vigente = true;
    setFranja(null);
    if (estadiaId) api.estadia(estadiaId).then((est) => { if (vigente) setFranja(franjaEntrada(est.entrada_en)); }).catch(() => {});
    return () => { vigente = false; };
  }, [estadiaId]);

  return (
    // Sin clic en toda la tarjeta: cada acción es un botón, que también funciona con el teclado (Sonar S1082).
    <article class={`cuarto-card cuarto-card--foto cuarto-card--${clase}${activa ? ' cuarto-card--activa' : ''}`} aria-label={`Habitación ${h.numero} · ${textoEstado(h.estado)}`}>
      <div class="cuarto-card__foto"><FotoHabitacion numero={h.numero} editable={false} /><span class="cuarto-card__demo">Demo</span></div>
      <div class="cuarto-card__cabecera">
        <div class="cuarto-card__icono-box">
          <Ico id="habitaciones" clase="cuarto-card__ico" />
        </div>
        <div class="cuarto-card__meta">
          <span class="cuarto-card__numero">{h.numero}</span>
          <span class={`cuarto-card__estado-pill cuarto-card__estado-pill--${clase}`}>
            {h.estado === 'DISPONIBLE' ? 'Libre' : textoEstado(h.estado)}
          </span>
        </div>
        <button
          type="button"
          class="cuarto-card__menu-btn"
          aria-label={`Opciones de habitación ${h.numero}`}
          onClick={() => alHacer('DETALLES', h)}
        >
          <Ico id="puntos-h" clase="ico--s cuarto-card__puntos" />
          <Ico id="flecha" clase="ico--s cuarto-card__flecha" />
        </button>
      </div>

      <div class="cuarto-card__cuerpo">
        <span class="cuarto-card__tipo"><Ico id={h.tipo === 'AIRE' ? 'aire' : 'ventilador'} clase="ico--xs" />{h.tipo === 'AIRE' ? 'Aire acondicionado' : 'Ventilador'}</span>
        {e && <span class={`cuarto-card__franja${franja ? ` cuarto-card__franja--${franja}` : ''}`} title={franja ? 'Hora de entrada en Bogotá: día de 6:00 a. m. a 5:59 p. m.; noche de 6:00 p. m. a 5:59 a. m.' : undefined}>
          <Ico id={franja === 'dia' ? 'sol' : franja === 'noche' ? 'luna' : 'reloj'} clase="ico--s" />
          {franja === 'dia' ? 'Entrada de día' : franja === 'noche' ? 'Entrada de noche' : 'Entrada sin hora disponible'}
        </span>}
      </div>

      <div class="cuarto-card__acciones">
        {botones.map((b) => (
          <button
            key={b.accion}
            type="button"
            class={`cuarto-card__btn ${b.principal ? 'cuarto-card__btn--rojo' : 'cuarto-card__btn--outline'}`}
            onClick={() => alHacer(b.accion, h)}
          >
            {b.texto}
          </button>
        ))}
      </div>
    </article>
  );
}

export function Mapa({
  habitaciones,
  esAdmin = false,
  recarga = 0,
  alElegir,
  alAbrir,
  alRevisar,
  alVerHoy,
}: {
  habitaciones: Habitacion[];
  esAdmin?: boolean;
  recarga?: number;
  alElegir?: (h: Habitacion) => void;
  alAbrir?: (h: Habitacion, inicio?: 'cuenta' | 'salida' | 'extender') => void;
  alRevisar?: (h: Habitacion) => void;
  alVerHoy?: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroMapa>('todas');
  const [detalles, setDetalles] = useState<Habitacion | null>(null);

  const c = contarEstados(habitaciones);
  const visibles = filtrarPorGrupo(habitaciones, filtro);
  const abierta = detalles && (habitaciones.find((h) => h.numero === detalles.numero) ?? null);

  function hacer(accion: AccionTarjeta, h: Habitacion) {
    if (accion === 'DETALLES') {
      setDetalles(h);
      return;
    }
    if (accion === 'ENTRADA') {
      setDetalles(null);
      alElegir?.(h);
      return;
    }
    if (accion === 'SALIDA') {
      alAbrir?.(h, 'salida');
      return;
    }
    alRevisar?.(h);
  }

  return (
    <div class="habitaciones-modulo">
      {/* Encabezado con icono rojo y migas de pan */}
      <div class="habitaciones-encabezado">
        <div class="habitaciones-icono-marca">
          <Ico id="habitaciones" clase="ico--l" />
        </div>
        <div class="habitaciones-titulos">
          <h1>Habitaciones</h1>
          <p class="habitaciones-migas">
            Sistema Administrativo <span class="separador-miga">›</span> Habitaciones
          </p>
        </div>
        {alVerHoy && <button type="button" class="btn btn--secundario habitaciones-ver-hoy" onClick={alVerHoy}><Ico id="huespedes" clase="ico--s" />Quiénes se quedan hoy</button>}
      </div>

      {/* Barra de filtros y selector de vistas (Imagen 1) */}
      <div class="habitaciones-barra-controles">
        <div class="habitaciones-filtros" role="group" aria-label="Filtrar habitaciones por estado">
          <button
            type="button"
            class={`hab-filtro-btn ${filtro === 'todas' ? 'hab-filtro-btn--activo' : ''}`}
            onClick={() => setFiltro('todas')}
          >
            Todos <span class="hab-filtro-cuenta">{habitaciones.length}</span>
          </button>

          <button
            type="button"
            class={`hab-filtro-btn ${filtro === 'ocupadas' ? 'hab-filtro-btn--activo' : ''}`}
            onClick={() => setFiltro(filtro === 'ocupadas' ? 'todas' : 'ocupadas')}
          >
            <span class="hab-filtro-dot hab-filtro-dot--rojo" />
            Ocupadas <span class="hab-filtro-cuenta">{c.ocupadas}</span>
          </button>

          <button
            type="button"
            class={`hab-filtro-btn ${filtro === 'disponibles' ? 'hab-filtro-btn--activo' : ''}`}
            onClick={() => setFiltro(filtro === 'disponibles' ? 'todas' : 'disponibles')}
          >
            <span class="hab-filtro-dot hab-filtro-dot--verde" />
            Libres <span class="hab-filtro-cuenta">{c.disponibles}</span>
          </button>

          <button
            type="button"
            class={`hab-filtro-btn ${filtro === 'limpieza' ? 'hab-filtro-btn--activo' : ''}`}
            onClick={() => setFiltro(filtro === 'limpieza' ? 'todas' : 'limpieza')}
          >
            <span class="hab-filtro-dot hab-filtro-dot--amarillo" />
            Limpieza <span class="hab-filtro-cuenta">{c.limpieza}</span>
          </button>

          <button
            type="button"
            class={`hab-filtro-btn ${filtro === 'porRevisar' ? 'hab-filtro-btn--activo' : ''}`}
            onClick={() => setFiltro(filtro === 'porRevisar' ? 'todas' : 'porRevisar')}
          >
            <span class="hab-filtro-dot hab-filtro-dot--gris" />
            Por revisar <span class="hab-filtro-cuenta">{c.porRevisar}</span>
          </button>
          <button type="button" class={filtro === 'mantenimiento' ? 'hab-filtro-btn hab-filtro-btn--activo' : 'hab-filtro-btn'} onClick={() => setFiltro(filtro === 'mantenimiento' ? 'todas' : 'mantenimiento')}>
            Mantenimiento <span class="hab-filtro-cuenta">{c.mantenimiento}</span>
          </button>
        </div>

      </div>

      {/* Contenedor principal: cuadrícula de habitaciones y panel lateral de detalles */}
      <div class={`habitaciones-layout ${abierta ? 'habitaciones-layout--con-panel' : ''}`}>
        <div class="habitaciones-contenido-grid">
          {visibles.length === 0 ? (
            <div class="nota">
              <Ico id="info" clase="ico--s" />
              <p>No hay habitaciones en este estado.</p>
            </div>
          ) : (
            <div class="habitaciones-grid">
              {visibles.map((h) => (
                <TarjetaCuarto
                  key={h.numero}
                  h={h}
                  activa={h.numero === abierta?.numero}
                  alHacer={hacer}
                />
              ))}
            </div>
          )}
        </div>

        {/* Panel lateral al hacer clic en Ver detalles (Imagen 1) */}
        {abierta && (
          <Panel titulo={`Habitación ${abierta.numero}`} ancho="detalle" alCerrar={() => setDetalles(null)}>
          <PanelHabitacion
            habitacion={abierta}
            esAdmin={esAdmin}
            recarga={recarga}
            alCerrar={() => setDetalles(null)}
            alVerCuenta={() => alAbrir?.(abierta)}
            alRegistrarSalida={() => alAbrir?.(abierta, 'salida')}
            alExtender={() => alAbrir?.(abierta, 'extender')}
            alCambiarEstado={() => alRevisar?.(abierta)}
            alRegistrarEntrada={() => alElegir?.(abierta)}
          />
          </Panel>
        )}
      </div>
    </div>
  );
}
