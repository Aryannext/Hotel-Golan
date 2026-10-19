// Mapa de las 12 habitaciones (FR-01), con las clases del prototipo (.mapa, .cuarto--estado).
import type { Habitacion } from '../api.ts';
import { claseEstado, contarEstados, hoyBogota, textoEstado } from '../logica.ts';
import { accionCuarto, detalleCuarto, pistaCuarto } from '../presentacion.ts';
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
  const Etiqueta = accion ? 'button' : 'div';
  const pista = pistaCuarto(que);
  return (
    <Etiqueta type={accion ? 'button' : undefined} onClick={accion}
      class={`cuarto cuarto--${claseEstado(h.estado)}`} aria-label={`Habitación ${h.numero}, ${textoEstado(h.estado)}${pista}`}>
      <span class="cuarto__num">{h.numero}</span>
      <Ico id={ICONO[h.estado] ?? 'habitaciones'} clase="cuarto__ico" />
      <span class="cuarto__estado">{textoEstado(h.estado)}{e?.vencida ? ' · salida vencida' : ''}</span>
      <span class="cuarto__dato">{e ? <><Ico id="huespedes" clase="ico--xs" />{e.nombre_corto}</> : (h.nota ?? '—')}</span>
      {detalle && <span class="cuarto__dato2">{detalle}</span>}
      <span class="cuarto__chips"><Ico id={h.tipo === 'AIRE' ? 'aire' : 'ventilador'} clase="ico--xs" />{h.tipo === 'AIRE' ? 'Aire' : 'Ventilador'}</span>
    </Etiqueta>
  );
}

export function Mapa({ habitaciones, alElegir, alAbrir, alRevisar }: {
  habitaciones: Habitacion[]; alElegir?: (h: Habitacion) => void; alAbrir?: (h: Habitacion) => void; alRevisar?: (h: Habitacion) => void;
}) {
  const c = contarEstados(habitaciones);
  return (
    <>
      {/* Una línea con los colores y cuántas hay de cada una: las habitaciones quedan a la vista sin bajar. */}
      <div class="mapa__cab">
        <h2>Habitaciones <span>Toque una para ver su cuenta o registrar una entrada.</span></h2>
        <ul class="leyenda" aria-label="Cuántas habitaciones hay en cada estado">
          <li class="leyenda__item leyenda__item--libre">{c.disponibles} disponibles</li>
          <li class="leyenda__item leyenda__item--ocupada">{c.ocupadas} ocupadas</li>
          <li class="leyenda__item leyenda__item--limpieza">{c.limpiezaORevision} en limpieza o revisión</li>
          <li class="leyenda__item leyenda__item--fuera">{c.mantenimiento} en mantenimiento</li>
        </ul>
      </div>
      <div class="mapa">{habitaciones.map((h) => <Cuarto key={h.numero} h={h} alElegir={alElegir} alAbrir={alAbrir} alRevisar={alRevisar} />)}</div>
    </>
  );
}
