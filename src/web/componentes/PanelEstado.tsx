// Revisar, limpiar o reparar una habitación (TICKET-08, FR-02): solo las transiciones permitidas, como en el prototipo.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Habitacion } from '../api.ts';
import { accionesEstado, pesos, textoEstado, type AccionEstado } from '../logica.ts';
import { Ico } from './Ico.tsx';

const AYUDA: Record<string, string> = {
  POR_REVISAR: 'La revisa la persona del turno. ¿Cómo quedó la habitación?',
  LIMPIEZA: 'Cuando termine la limpieza y la revise, la habitación queda disponible.',
  MANTENIMIENTO: 'Cuando el daño esté arreglado, vuelve a revisión antes de ofrecerla.',
};

export function PanelEstado({ habitacion: h, alCerrar, alCambiar }: { habitacion: Habitacion; alCerrar: () => void; alCambiar: (texto: string) => void }) {
  const [danio, setDanio] = useState(false);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const escape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', escape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', escape); document.body.style.overflow = ''; };
  }, []);

  async function aplicar(a: AccionEstado) {
    if (a.pideNota && !danio) { setDanio(true); return; }
    setEnviando(true);
    setError('');
    try {
      const r = await api.cambiarEstado(h.numero, { estado: a.estado, ...(a.especial ? { limpieza_especial: true } : {}), ...(a.pideNota && nota.trim() ? { nota: nota.trim() } : {}) });
      alCambiar(a.especial
        ? `Habitación ${h.numero} en limpieza especial. Recuerde: el recargo de ${pesos(20000)} se le entrega a quien limpió (salida de caja).`
        : `Habitación ${h.numero}: ${textoEstado(r.estado).toLowerCase()}.`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const acciones = accionesEstado(h.estado);
  const danioAccion = acciones.find((a) => a.pideNota);
  return (
    <div class="capa-panel">
      <div class="velo velo--visible" onClick={alCerrar} />
      <section class="panel" role="dialog" aria-modal="true" aria-labelledby="panel-titulo">
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label={danio ? 'Volver' : 'Cerrar'} onClick={() => (danio ? setDanio(false) : alCerrar())}><Ico id={danio ? 'atras' : 'cerrar'} clase="ico--s" /></button>
          <div class="titulos"><h2 id="panel-titulo">{h.estado === 'POR_REVISAR' ? `Revisar habitación ${h.numero}` : `Habitación ${h.numero}`}</h2>
            <p>{h.tipo === 'AIRE' ? 'Aire acondicionado' : 'Ventilador'} · {textoEstado(h.estado)}{h.nota ? ` · ${h.nota}` : ''}</p></div>
        </div>
        <div class="panel__cuerpo">
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
          {danio && danioAccion ? <>
            <div class="campo"><label for="nota-danio">¿Qué se dañó?</label>
              <textarea id="nota-danio" rows={2} maxLength={200} placeholder="Ej. la ducha gotea" value={nota} onInput={(e) => setNota((e.target as HTMLTextAreaElement).value)} /></div>
            <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={() => aplicar(danioAccion)}>
              <Ico id="herramienta" clase="ico--s" />Mandar a mantenimiento</button>
          </> : <>
            <p class="ayuda">{AYUDA[h.estado]}</p>
            <div class="pila" style="gap:10px">
              {acciones.map((a) => <>
                <button type="button" class={`btn ${acciones.length === 1 ? 'btn--primario' : 'btn--secundario'} btn--l`} disabled={enviando} onClick={() => aplicar(a)}>
                  <Ico id={a.icono} clase="ico--s" />{a.texto}</button>
                {a.especial && <p class="ayuda">Si fue extremo (vómito, fluidos), al huésped se le cobran {pesos(20000)} y se le entregan a quien hace el aseo.</p>}
              </>)}
            </div>
          </>}
        </div>
      </section>
    </div>
  );
}
