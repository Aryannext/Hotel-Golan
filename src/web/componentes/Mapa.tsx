// Mapa de las 12 habitaciones (FR-01), con las clases del prototipo (.mapa, .cuarto--estado).
import type { Habitacion } from '../api.ts';
import { claseEstado, contarEstados, diaRelativo, horaBogota, hoyBogota, pesos, textoEstado } from '../logica.ts';
import { Ico } from './Ico.tsx';

const ICONO: Record<string, string> = { MANTENIMIENTO: 'herramienta', LIMPIEZA: 'escoba', POR_REVISAR: 'lupa' };

function Cuarto({ h, alElegir, alAbrir, alRevisar }: {
  h: Habitacion; alElegir?: (h: Habitacion) => void; alAbrir?: (h: Habitacion) => void; alRevisar?: (h: Habitacion) => void;
}) {
  const e = h.estadia_activa;
  const detalle = e
    ? `Sale ${diaRelativo(e.salida_prevista_en, hoyBogota())} ${horaBogota(e.salida_prevista_en)}${e.saldo ? ' · debe ' + pesos(e.saldo) : e.por_verificar ? ' · por verificar' : ''}`
    : '';
  // Disponible: registrar una entrada (TICKET-04). Con estadía: su ficha (TICKET-06). Por revisar, limpieza o mantenimiento: cambiar su estado (TICKET-08).
  const accion = h.estado === 'DISPONIBLE' && alElegir ? () => alElegir(h) : e && alAbrir ? () => alAbrir(h)
    : !e && h.estado !== 'DISPONIBLE' && alRevisar ? () => alRevisar(h) : undefined;
  const Etiqueta = accion ? 'button' : 'div';
  const pista = !accion ? '' : h.estado === 'DISPONIBLE' ? ', tocar para registrar una entrada' : e ? ', tocar para ver la cuenta' : ', tocar para cambiar su estado';
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
      <div class="titulo-vista"><div><h1>Habitaciones</h1><p>Toque una habitación para registrar una entrada, ver su cuenta o cambiar su estado</p></div></div>
      <div class="stats" style="margin:0 0 16px">
        <div class="stat stat--libre"><span class="stat__ico"><Ico id="habitaciones" clase="ico--l" /></span><span><strong>{c.disponibles}</strong><span>Disponibles</span></span></div>
        <div class="stat stat--ocupada"><span class="stat__ico"><Ico id="habitaciones" clase="ico--l" /></span><span><strong>{c.ocupadas}</strong><span>Ocupadas</span></span></div>
        <div class="stat stat--limpieza"><span class="stat__ico"><Ico id="escoba" clase="ico--l" /></span><span><strong>{c.limpiezaORevision}</strong><span>Limpieza o revisión</span></span></div>
        <div class="stat stat--fuera"><span class="stat__ico"><Ico id="herramienta" clase="ico--l" /></span><span><strong>{c.mantenimiento}</strong><span>Mantenimiento</span></span></div>
      </div>
      <div class="mapa">{habitaciones.map((h) => <Cuarto key={h.numero} h={h} alElegir={alElegir} alAbrir={alAbrir} alRevisar={alRevisar} />)}</div>
    </>
  );
}
