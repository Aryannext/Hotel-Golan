// Mapa de las 12 habitaciones (FR-01), con las clases del prototipo (.mapa, .cuarto--estado).
import { useState } from 'preact/hooks';
import type { Habitacion } from '../api.ts';
import { claseEstado, contarEstados, filtrarPorGrupo, hoyBogota, textoEstado, type FiltroMapa, type GrupoEstado } from '../logica.ts';
import { accionCuarto, botonCuarto, detalleCuarto } from '../presentacion.ts';
import { Ico } from './Ico.tsx';

const ICONO: Record<string, string> = { MANTENIMIENTO: 'herramienta', LIMPIEZA: 'escoba', POR_REVISAR: 'lupa' };

function Cuarto({ h, alElegir, alAbrir, alRevisar }: {
  h: Habitacion; alElegir?: (h: Habitacion) => void; alAbrir?: (h: Habitacion) => void; alRevisar?: (h: Habitacion) => void;
}) {
  const e = h.estadia_activa;
  const detalle = detalleCuarto(h, hoyBogota());
  // Disponible: registrar una entrada (TICKET-04). Con estadía: su ficha (TICKET-06). Por revisar, limpieza o mantenimiento: cambiar su estado (TICKET-08).
  const que = accionCuarto(h, { elegir: !!alElegir, abrir: !!alAbrir, revisar: !!alRevisar });
  const manejador = que && { ENTRADA: alElegir, CUENTA: alAbrir, ESTADO: alRevisar }[que];
  const accion = manejador ? () => manejador(h) : undefined;
  const texto = botonCuarto(que);
  // La tarjeta deja de ser un botón entero: la acción se ve escrita (BOCETO 04).
  // Un botón no puede contener otro botón, así que el contenedor pasa a ser <article>.
  return (
    <article class={`cuarto cuarto--${claseEstado(h.estado)}`}>
      <Ico id={ICONO[h.estado] ?? 'habitaciones'} clase="cuarto__ico" />
      <span class="cuarto__num">{h.numero}</span>
      {/* El estado va en pastilla, como en el BOCETO 03. */}
      <span class={`pill pill--${claseEstado(h.estado)}`}>{textoEstado(h.estado)}</span>
      {e?.vencida && <span class="cuarto__vencida">Salida vencida</span>}
      <span class="cuarto__dato">{e ? <><Ico id="huespedes" clase="ico--xs" />{e.nombre_corto}</> : (h.nota ?? '—')}</span>
      {detalle && <span class="cuarto__dato2">{detalle}</span>}
      <span class="cuarto__chips"><Ico id={h.tipo === 'AIRE' ? 'aire' : 'ventilador'} clase="ico--xs" />{h.tipo === 'AIRE' ? 'Aire' : 'Ventilador'}</span>
      {accion && texto && <button type="button" class={`btn btn--mini cuarto__accion ${que === 'ENTRADA' ? 'btn--primario' : 'btn--secundario'}`}
        onClick={accion} aria-label={`${texto} · habitación ${h.numero}`}>{texto}</button>}
    </article>
  );
}

// Cada indicador del encabezado filtra el mapa por su propio grupo (TICKET-01, rediseño).
const INDICADORES: Array<{ grupo: GrupoEstado; clase: string; ico: string; texto: string }> = [
  { grupo: 'disponibles', clase: 'libre', ico: 'habitaciones', texto: 'Disponibles' },
  { grupo: 'ocupadas', clase: 'ocupada', ico: 'habitaciones', texto: 'Ocupadas' },
  { grupo: 'limpiezaORevision', clase: 'limpieza', ico: 'escoba', texto: 'Limpieza o revisión' },
  { grupo: 'mantenimiento', clase: 'fuera', ico: 'herramienta', texto: 'Mantenimiento' },
];

export function Mapa({ habitaciones, alElegir, alAbrir, alRevisar }: {
  habitaciones: Habitacion[]; alElegir?: (h: Habitacion) => void; alAbrir?: (h: Habitacion) => void; alRevisar?: (h: Habitacion) => void;
}) {
  const [filtro, setFiltro] = useState<FiltroMapa>('todas');
  const [vista, setVista] = useState<'cuadricula' | 'lista'>('cuadricula');
  const c = contarEstados(habitaciones);
  const visibles = filtrarPorGrupo(habitaciones, filtro);
  return (
    <>
      <div class="titulo-vista"><div>
        <h1>Habitaciones</h1>
        <p class="migas">Sistema de recepción <Ico id="adelante" clase="ico--xs" /> Habitaciones</p>
      </div></div>
      <div class="stats" style="margin:0 0 16px">
        {INDICADORES.map((i) => (
          <div key={i.grupo} class={`stat stat--${i.clase}`}>
            <span class="stat__ico"><Ico id={i.ico} clase="ico--l" /></span>
            <span><strong>{c[i.grupo]}</strong><span>{i.texto}</span></span>
          </div>
        ))}
      </div>

      {/* Filtros en pastillas con su cuenta y el cambio de vista, como el BOCETO 04. */}
      <div class="filtros">
        <div class="filtros__grupo" role="group" aria-label="Filtrar por estado">
          <button type="button" class="filtro" aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>
            Todas <span class="filtro__cuenta">{habitaciones.length}</span>
          </button>
          {INDICADORES.map((i) => (
            <button key={i.grupo} type="button" class={`filtro filtro--${i.clase}`} aria-pressed={filtro === i.grupo}
              onClick={() => setFiltro(filtro === i.grupo ? 'todas' : i.grupo)}>
              {i.texto} <span class="filtro__cuenta">{c[i.grupo]}</span>
            </button>
          ))}
        </div>
        <div class="filtros__vista" role="group" aria-label="Cómo se ven las habitaciones">
          <button type="button" class="filtro" aria-pressed={vista === 'cuadricula'} onClick={() => setVista('cuadricula')}>
            <Ico id="habitaciones" clase="ico--xs" />Cuadrícula
          </button>
          <button type="button" class="filtro" aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}>
            <Ico id="menu" clase="ico--xs" />Lista
          </button>
        </div>
      </div>
      {visibles.length === 0
        ? <div class="nota"><Ico id="info" clase="ico--s" /><p>No hay habitaciones en este estado.</p></div>
        : <div class={`mapa${vista === 'lista' ? ' mapa--lista' : ''}`}>{visibles.map((h) => <Cuarto key={h.numero} h={h} alElegir={alElegir} alAbrir={alAbrir} alRevisar={alRevisar} />)}</div>}
    </>
  );
}
