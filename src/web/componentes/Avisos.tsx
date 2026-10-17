// Avisos en pantalla (TICKET-16, FR-23): la campana de la barra superior y «Pendientes» al inicio de Habitaciones.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Aviso } from '../avisos.ts';
import { Ico } from './Ico.tsx';

const ICONOS: Record<Aviso['tipo'], string> = { VENCIDA: 'reloj', POR_VERIFICAR: 'transferencia', POR_REVISAR: 'lupa', LIMPIEZA: 'escoba' };

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

export function Pendientes({ avisos, alElegir }: { avisos: Aviso[]; alElegir: (a: Aviso) => void }) {
  if (avisos.length === 0) return null;
  return <section class="tarjeta pendientes" aria-labelledby="pendientes-titulo">
    <div class="tarjeta__cab"><h2 id="pendientes-titulo"><Ico id="campana" clase="ico--s" />Pendientes</h2>
      <span class="pill pill--aviso">{avisos.length}</span></div>
    <ListaAvisos avisos={avisos} alElegir={alElegir} />
  </section>;
}

export function Campana({ avisos, alElegir }: { avisos: Aviso[]; alElegir: (a: Aviso) => void }) {
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

  const etiqueta = avisos.length === 0 ? 'Avisos: no hay pendientes' : `Avisos: ${avisos.length} pendiente${avisos.length === 1 ? '' : 's'}`;
  return <div class="campana" ref={caja}>
    <button type="button" class="redondo campana__boton" aria-label={etiqueta} aria-expanded={abierta} aria-haspopup="true" onClick={() => setAbierta(!abierta)}>
      <Ico id="campana" clase="ico--s" />
      {avisos.length > 0 && <span class={`campana__cuenta${urgentes > 0 ? ' campana__cuenta--urgente' : ''}`} aria-hidden="true">{avisos.length}</span>}
    </button>
    {abierta && <div class="campana__panel">
      <p class="campana__titulo">Avisos</p>
      {avisos.length === 0
        ? <p class="vacio">Todo al día: no hay salidas vencidas, transferencias ni habitaciones pendientes.</p>
        : <ListaAvisos avisos={avisos} alElegir={(a) => { setAbierta(false); alElegir(a); }} />}
    </div>}
  </div>;
}
