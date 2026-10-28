// «Salió plata» (TICKET-10, FR-12): compra para el hotel, retiro de la administración, recargo de aseo u otro.
// Baja el «debe haber» y no cuenta como venta. Las devoluciones se registran desde la estadía (TICKET-09).
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { mensajeDeError } from '../envio.ts';
import { leerPesos, nuevaClave, pesos, TIPOS_SALIDA, type TipoSalida } from '../logica.ts';
import { Ico } from './Ico.tsx';

const HABITACIONES = ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '301'];

export function SalidaDinero({ debeHaber, alCerrar, alRegistrar }: { debeHaber: number; alCerrar: () => void; alRegistrar: (texto: string) => void }) {
  const [tipo, setTipo] = useState<TipoSalida>('COMPRA_HOTEL');
  const [detalle, setDetalle] = useState('');
  const [valor, setValor] = useState('');
  const [hab, setHab] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [clave] = useState(nuevaClave);

  useEffect(() => {
    const escape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', escape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', escape); document.body.style.overflow = ''; };
  }, []);

  const t = TIPOS_SALIDA.find((x) => x.tipo === tipo)!;
  const monto = leerPesos(valor) ?? 0;
  const quedaria = debeHaber - monto;

  function elegir(nuevo: TipoSalida) {
    setTipo(nuevo);
    const sugerido = TIPOS_SALIDA.find((x) => x.tipo === nuevo)!.valor;
    if (sugerido) setValor(String(sugerido));
  }

  async function registrar() {
    if (detalle.trim().length < 3) { setError('Escriba para qué fue (mínimo 3 letras).'); return; }
    if (monto < 1) { setError('Escriba el valor que salió de la caja.'); return; }
    if (tipo === 'RECARGO_ASEO' && !hab) { setError('Elija la habitación que se limpió.'); return; }
    setEnviando(true);
    setError('');
    try {
      await api.registrarSalida({ tipo, detalle: detalle.trim(), valor: monto, ...(tipo === 'RECARGO_ASEO' ? { habitacion_numero: hab } : {}) }, clave);
      alRegistrar(`Salida registrada: ${pesos(monto)} (${t.texto.toLowerCase()}). En la caja deben quedar ${pesos(quedaria)}.`);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div class="capa-panel">
      <button type="button" class="velo velo--visible" aria-label="Cerrar" tabIndex={-1} onClick={alCerrar} />
      <dialog open class="panel" aria-modal="true" aria-labelledby="panel-titulo">
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label="Cerrar" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
          <div class="titulos"><h2 id="panel-titulo">Salió plata</h2><p>En la caja debe haber {pesos(debeHaber)}</p></div>
        </div>
        <div class="panel__cuerpo">
          <div class="nota"><Ico id="info" clase="ico--s" /><p>Es efectivo que <b>sale de la caja</b> y por eso baja la base. El pago del turno no va aquí: se descuenta al entregar. Una devolución a un cliente se registra desde su habitación.</p></div>
          <section class="tarjeta">
            <div class="tarjeta__cab"><h3>¿Para qué salió?</h3></div>
            <div class="segmentado segmentado--columna">{TIPOS_SALIDA.map((x) =>
              <button key={x.tipo} type="button" class="opcion" aria-pressed={tipo === x.tipo} onClick={() => elegir(x.tipo)}>{x.texto}</button>)}</div>
            {tipo === 'RECARGO_ASEO' && <div class="campo"><label htmlFor="salida-hab">Habitación que se limpió</label>
              <select id="salida-hab" value={hab} onChange={(e) => setHab((e.target as HTMLSelectElement).value)}>
                <option value="">Elija la habitación</option>{HABITACIONES.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>}
            <div class="campo"><label htmlFor="salida-detalle">Detalle</label>
              <input id="salida-detalle" autocomplete="off" maxLength={200} placeholder={t.ejemplo} value={detalle} onInput={(e) => setDetalle((e.target as HTMLInputElement).value)} /></div>
            <div class="campo"><label htmlFor="salida-valor">Valor</label>
              <input id="salida-valor" inputmode="numeric" autocomplete="off" placeholder="Ej. 10000" value={valor} onInput={(e) => setValor((e.target as HTMLInputElement).value)} /></div>
            {monto > 0 && <div class={`saldo ${quedaria < 0 ? 'saldo--alerta' : 'saldo--ok'}`}><div>
              <b>{quedaria < 0 ? 'No alcanza la caja' : 'Quedarán en la caja'}</b>
              <p>{quedaria < 0 ? 'Revise el valor: sale más de lo que debería haber.' : 'Después de sacar este dinero.'}</p></div><strong>{pesos(quedaria)}</strong></div>}
          </section>
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
        </div>
        <div class="panel__pie">
          <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={registrar}><Ico id="baja" clase="ico--s" />Registrar salida{monto ? ` de ${pesos(monto)}` : ''}</button>
        </div>
      </dialog>
    </div>
  );
}
