// Avisos en pantalla (TICKET-16, FR-23): la campana de la barra superior y «Pendientes» al inicio de Habitaciones.
import { useEffect, useRef, useState } from 'preact/hooks';
import { textoSinRevisar, textoVacioAvisos, type Aviso, type Fuente } from '../avisos.ts';
import { Ico } from './Ico.tsx';
import { etiquetaCampana, textoPendientes } from '../presentacion.ts';

const ICONOS: Record<Aviso['tipo'], string> = { VENCIDA: 'reloj', MIGRACION: 'enviar', POR_VERIFICAR: 'transferencia', POR_REVISAR: 'lupa', LIMPIEZA: 'escoba', EXISTENCIAS: 'vitrina' };

/** La hora «actual» de la pantalla, renovada cada cierto tiempo para que los vencimientos aparezcan solos. */
export function useAhora(cadaMs = 30_000): number {
  const [ahora, setAhora] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}

export function ListaAvisos({ avisos, alElegir }: { avisos: Aviso[]; alElegir: (a: Aviso) => void }) {
  return <ul class="lista-avisos">{avisos.map((a) => <li key={a.clave}>
    <button type="button" class={`aviso-item aviso-item--${a.tono}`} onClick={() => alElegir(a)}>
      <Ico id={ICONOS[a.tipo]} clase="ico--s" />
      <span class="aviso-item__txt"><b>{a.titulo}</b><span>{a.detalle}</span></span>
      <Ico id="flecha" clase="ico--xs" />
    </button>
  </li>)}</ul>;
}

/**
 * «Pendientes» del inicio: una sola línea que se abre al tocarla, para que las habitaciones se vean de una vez.
 * Si hay algo urgente (en rojo), la línea también va en rojo.
 */
export function Pendientes({ avisos, sinRevisar, alElegir }: { avisos: Aviso[]; sinRevisar: Fuente[]; alElegir: (a: Aviso) => void }) {
  const [abierto, setAbierto] = useState(false);
  const falta = textoSinRevisar(sinRevisar);
  if (avisos.length === 0 && !falta) return null;
  const urgente = avisos.some((a) => a.tono === 'alerta');
  return <section class="pendientes">
    {falta && <div class="nota nota--alerta" role="status"><Ico id="alerta" clase="ico--s" /><p>{falta}</p></div>}
    {avisos.length > 0 && <>
    <button type="button" class={`pendientes__resumen${urgente ? ' pendientes__resumen--urgente' : ''}`} aria-expanded={abierto}
      aria-controls="pendientes-lista" onClick={() => setAbierto(!abierto)}>
      <Ico id={urgente ? 'alerta' : 'campana'} clase="ico--s" />
      <span class="pendientes__texto"><b>{textoPendientes(avisos.length)}</b><span>{abierto ? 'Toque para ocultar' : 'Toque para ver'}</span></span>
      <Ico id="flecha" clase={`ico--xs pendientes__flecha${abierto ? ' pendientes__flecha--abierta' : ''}`} />
    </button>
    {abierto && <div id="pendientes-lista"><ListaAvisos avisos={avisos} alElegir={alElegir} /></div>}
    </>}
  </section>;
}

export function Campana({ avisos, sinRevisar, alElegir }: { avisos: Aviso[]; sinRevisar: Fuente[]; alElegir: (a: Aviso) => void }) {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const urgentes = avisos.filter((a) => a.tono !== 'info').length;

  useEffect(() => {
    if (!abierta) return;
    const fuera = (ev: MouseEvent) => { if (caja.current && !caja.current.contains(ev.target as Node)) setAbierta(false); };
    const escape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setAbierta(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', escape); };
  }, [abierta]);

  const falta = textoSinRevisar(sinRevisar);
  const etiqueta = falta ? `${etiquetaCampana(avisos.length)}. ${falta}` : etiquetaCampana(avisos.length);
  return <div class="campana" ref={caja}>
    <button type="button" class="redondo campana__boton" aria-label={etiqueta} aria-expanded={abierta} aria-haspopup="true" onClick={() => setAbierta(!abierta)}>
      <Ico id="campana" clase="ico--s" />
      {(avisos.length > 0 || falta) && <span class={`campana__cuenta${urgentes > 0 || falta ? ' campana__cuenta--urgente' : ''}`} aria-hidden="true">{avisos.length || '!'}</span>}
    </button>
    {abierta && <div class="campana__panel">
      <p class="campana__titulo">Avisos</p>
      {falta && avisos.length > 0 && <p class="campana__falta">{falta}</p>}
      {avisos.length === 0
        ? <p class="vacio">{textoVacioAvisos(sinRevisar)}</p>
        : <ListaAvisos avisos={avisos} alElegir={(a) => { setAbierta(false); alElegir(a); }} />}
    </div>}
  </div>;
}
