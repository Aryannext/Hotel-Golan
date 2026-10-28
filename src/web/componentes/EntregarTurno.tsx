// «Entregar turno» (TICKET-11, FR-13; RN-11), como en el prototipo: ¿tomó su pago?, conteo obligatorio y motivo si no cuadra.
// Al entregar se cierra la sesión; quien llega confirma con un toque lo que recibió.
// HAL-18 [P/V]: si quien lo tenía se fue sin entregarlo, la administración lo cierra con el motivo y su sesión sigue.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Turno } from '../api.ts';
import { avisoTemprano, debeDejar, diferenciaConteo, leerPesos, pesos } from '../logica.ts';
import { Ico } from './Ico.tsx';

export function EntregarTurno({ turno, porAdministracion = false, alCerrar, alEntregar }: {
  turno: Turno; porAdministracion?: boolean; alCerrar: () => void; alEntregar: (texto: string) => void;
}) {
  const [motivoCierre, setMotivoCierre] = useState('');
  const [pagoTomado, setPagoTomado] = useState<boolean | null>(null);
  const [contado, setContado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const escape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', escape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', escape); document.body.style.overflow = ''; };
  }, []);

  const c = turno.caja;
  const dejar = debeDejar(c.debe_haber, c.pago_turno, pagoTomado === true);
  const valor = leerPesos(contado);
  const dif = valor === null ? null : diferenciaConteo(valor, dejar);
  const temprano = avisoTemprano(turno.fin_programado_en);
  const siguiente = turno.tipo === 'NOCHE' ? 'de día' : 'de noche';

  async function entregar() {
    // Nada se registra como contado si nadie contó; una diferencia necesita explicación.
    if (porAdministracion && motivoCierre.trim().length < 5) { setError('Escriba por qué cierra usted este turno (mínimo 5 letras).'); return; }
    if (pagoTomado === null) { setError('Responda si tomó su pago del turno de la caja.'); return; }
    if (valor === null) { setError('Escriba cuánto efectivo contó, aunque coincida.'); return; }
    if (valor !== dejar && motivo.trim().length < 5) { setError('Explique por qué no cuadra (mínimo 5 letras).'); return; }
    setEnviando(true);
    setError('');
    try {
      await api.entregarTurno({
        pago_tomado: pagoTomado, efectivo_contado: valor, ...(valor !== dejar ? { motivo_diferencia: motivo.trim() } : {}),
        ...(porAdministracion ? { motivo_cierre: motivoCierre.trim() } : {}),
      });
      alEntregar(porAdministracion
        ? `Cerró el turno de ${turno.responsable ?? 'recepción'} con ${pesos(valor)} en la caja. El turno ${siguiente} queda por recibir.`
        : `Turno entregado con ${pesos(valor)} en la caja. Ahora inicia sesión quien recibe el turno ${siguiente}.`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo.');
      setEnviando(false);
    }
  }

  return (
    <div class="capa-panel">
      <button type="button" class="velo velo--visible" aria-label="Cerrar" tabIndex={-1} onClick={alCerrar} />
      <dialog open class="panel" aria-modal="true" aria-labelledby="panel-titulo">
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label="Cerrar" onClick={alCerrar}><Ico id="cerrar" clase="ico--s" /></button>
          <div class="titulos"><h2 id="panel-titulo">{porAdministracion ? 'Cerrar un turno sin entregar' : 'Entregar turno'}</h2>
            <p>Turno {turno.tipo === 'NOCHE' ? 'de noche' : 'de día'} de {turno.responsable}</p></div>
        </div>
        <div class="panel__cuerpo">
          {porAdministracion && <div class="campo"><label htmlFor="motivo-cierre">¿Por qué lo cierra usted? <span class="req">*</span></label>
            <input id="motivo-cierre" autocomplete="off" maxLength={300} placeholder={`Ej. ${turno.responsable ?? 'la recepcionista'} se fue sin entregar`} value={motivoCierre}
              onInput={(e) => setMotivoCierre((e.target as HTMLInputElement).value)} />
            <span class="ayuda">Solo si quien tenía el turno ya no está. Cuente usted la plata; queda registrado a su nombre.</span></div>}
          {!porAdministracion && temprano && <div class="saldo saldo--aviso"><div><b>Todavía no es hora del relevo</b><p>{temprano}</p></div></div>}
          <section class="tarjeta tarjeta--crema">
            <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">En la caja debe haber</div></div><div class="fila__valor">{pesos(c.debe_haber)}</div></div>
          </section>
          <section class="tarjeta"><div class="tarjeta__cab"><h3>{porAdministracion ? `¿${turno.responsable ?? 'Quien tenía el turno'} tomó su pago` : '¿Tomó su pago'} del turno ({pesos(c.pago_turno)}) de la caja?</h3></div>
            <div class="segmentado">
              <button type="button" class="opcion" aria-pressed={pagoTomado === true} onClick={() => setPagoTomado(true)}>{porAdministracion ? 'Sí, lo tomó' : 'Sí, lo tomé'}</button>
              <button type="button" class="opcion" aria-pressed={pagoTomado === false} onClick={() => setPagoTomado(false)}>{porAdministracion ? 'No, se le paga aparte' : 'No, me lo pagan aparte'}</button>
            </div>
            <p class="ayuda">Normalmente el pago del turno sale de la caja al entregar.</p>
          </section>
          {pagoTomado !== null && <>
            <section class="tarjeta tarjeta--crema">
              {pagoTomado && <div class="fila"><div class="fila__txt"><div class="fila__concepto">{porAdministracion ? 'Pago del turno' : 'Su pago del turno'}</div></div><div class="fila__valor">−{pesos(c.pago_turno)}</div></div>}
              <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Debe dejar</div></div><div class="fila__valor">{pesos(dejar)}</div></div>
            </section>
            <div class="campo"><label htmlFor="contado">Cuente la plata. ¿Cuánto deja en la caja? <span class="req">*</span></label>
              <input id="contado" inputmode="numeric" autocomplete="off" placeholder={`Ej. ${dejar}`} value={contado} onInput={(e) => setContado((e.target as HTMLInputElement).value)} /></div>
            {dif ? <p><span class={`pill pill--${dif.tono}`}>{dif.texto}</span></p> : <p class="ayuda">Escriba lo que contó, aunque coincida.</p>}
            {dif?.tono === 'alerta' && <div class="campo"><label htmlFor="motivo">¿Por qué no cuadra? <span class="req">*</span></label>
              <input id="motivo" autocomplete="off" maxLength={300} placeholder="Ej. devolví $5.000 a la 205 y no lo anoté" value={motivo}
                onInput={(e) => setMotivo((e.target as HTMLInputElement).value)} />
              <span class="ayuda">La diferencia queda registrada a su nombre; el sistema no descuenta nada.</span></div>}
          </>}
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
          <p class="ayuda">{porAdministracion ? 'Su sesión sigue abierta. Quien llega confirma con un toque que recibió la plata.'
            : 'Al entregar se cierra su sesión. Quien llega confirma con un toque que recibió la plata.'}</p>
        </div>
        <div class="panel__pie">
          <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={entregar}><Ico id="check" clase="ico--s" />{enviando ? 'Guardando…' : porAdministracion ? 'Cerrar el turno' : 'Entregar turno'}</button>
        </div>
      </dialog>
    </div>
  );
}
