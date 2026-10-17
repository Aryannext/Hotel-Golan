// Asistente «Nueva entrada» (TICKET-04, FR-03, FR-05): 1) datos del titular y autorización, 2) habitación y servicio, 3) confirmar y cobrar.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Cotizacion, type Estadia, type FormaPago, type Habitacion } from '../api.ts';
import {
  AVISO_VERSION, HUESPED_VACIO, TIPOS_DOCUMENTO, aHuespedInput, cambioEfectivo, enmascarar, erroresHuesped, horaBogota, hoyBogota, leerPesos, nuevaClave, pesos, textoSalida,
  type FormHuesped,
} from '../logica.ts';
import { PasoServicio, SERVICIO_INICIAL, type Servicio } from './PasoServicio.tsx';
import { Ico } from './Ico.tsx';
import { entradaIso, errorTardio } from '../tardio.ts';
import { fechaReporte } from '../reportes.ts';
import type { Reglas, Tarifa } from '../ajustes.ts';
import { leerDescuento } from '../textosConfig.ts';

const PASOS = ['Datos del huésped', 'Habitación y servicio', 'Confirmar'];
const FORMAS: Array<[FormaPago, string]> = [['EFECTIVO', 'Efectivo'], ['NEQUI', 'Nequi'], ['BANCOLOMBIA', 'Bancolombia'], ['AL_SALIR', 'Paga al salir']];

export function Entrada({ habitacion, reglas, alVolver, alRegistrar }: {
  habitacion: Habitacion; reglas: Reglas | null; alVolver: () => void; alRegistrar: (e: Estadia) => void;
}) {
  const [paso, setPaso] = useState(1);
  const [h, setH] = useState<FormHuesped>(HUESPED_VACIO);
  const [verErrores, setVerErrores] = useState(false);
  const [servicio, setServicio] = useState<Servicio>(SERVICIO_INICIAL);
  const [cot, setCot] = useState<Cotizacion | null>(null);
  const [errorCot, setErrorCot] = useState('');
  const [forma, setForma] = useState<FormaPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Una clave por asistente: un doble toque o un reintento no duplican la entrada (Idempotency-Key).
  const [clave] = useState(() => nuevaClave());
  // Tarifas vigentes para la ayuda de personas; si no cargan, la ayuda va sin importe.
  const [tarifas, setTarifas] = useState<Tarifa[] | null>(null);
  useEffect(() => { api.tarifas().then((r) => setTarifas(r.items)).catch(() => undefined); }, []);

  useEffect(() => {
    let vigente = true;
    const s = servicio;
    // Registro tardío: sin una hora real válida no se cotiza (el paso no deja seguir).
    const fallaTardio = s.tardio ? errorTardio(s.entrada, Date.now()) : null;
    if (fallaTardio) { setCot(null); setErrorCot('Con la hora real de entrada se calculan el precio y la salida.'); return; }
    // Descuento: sin un valor válido (mayor que $0 y hasta el máximo) no se cotiza.
    const desc = s.modalidad === 'NOCHE' && s.descuento ? leerDescuento(s.valorDescuento, reglas) : { valor: 0, error: null };
    if (desc.error) { setCot(null); setErrorCot('Corrija el descuento para ver el precio.'); return; }
    const entrada_en = s.tardio ? entradaIso(s.entrada) ?? undefined : undefined;
    api.cotizar({ habitacion_numero: habitacion.numero, modalidad: s.modalidad, personas: s.personas, noches: s.modalidad === 'NOCHE' ? s.noches : 1, valor_descuento: desc.valor ?? 0, entrada_en })
      .then((c) => { if (vigente) { setCot(c); setErrorCot(''); } })
      .catch((e: Error) => { if (vigente) setErrorCot(e.message); });
    return () => { vigente = false; };
  }, [habitacion.numero, servicio, reglas]);

  // Si deja de permitirse pagar al salir (más noches o tres horas), vuelve a efectivo.
  useEffect(() => { if (forma === 'AL_SALIR' && cot && !cot.permite_pago_al_salir) setForma('EFECTIVO'); }, [cot]);

  const errores = erroresHuesped(h);
  const campo = <K extends keyof FormHuesped>(k: K, v: FormHuesped[K]) => setH({ ...h, [k]: v });
  const err = (k: keyof FormHuesped) => (verErrores ? errores[k] : undefined);

  function siguiente() {
    setError('');
    if (paso === 1 && Object.keys(errores).length) { setVerErrores(true); return; }
    if (paso === 2 && !cot) return;
    setPaso(paso + 1);
  }

  async function registrar() {
    if (!cot) return;
    const valor = forma === 'EFECTIVO' ? leerPesos(recibido) ?? cot.total : undefined;
    setEnviando(true);
    setError('');
    try {
      alRegistrar(await api.registrarEntrada({
        habitacion_numero: habitacion.numero, modalidad: servicio.modalidad, personas: servicio.personas,
        noches: servicio.modalidad === 'NOCHE' ? servicio.noches : 1,
        valor_descuento: servicio.modalidad === 'NOCHE' && servicio.descuento ? leerDescuento(servicio.valorDescuento, reglas).valor ?? 0 : 0,
        ...(servicio.tardio ? { registro_tardio: true, entrada_en: entradaIso(servicio.entrada) ?? undefined } : {}),
        huesped: aHuespedInput(h), autorizacion: { otorgada: h.autorizo, version_aviso: AVISO_VERSION },
        pago: forma === 'EFECTIVO' ? { forma, valor_recibido: valor } : { forma },
      }, clave));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo: no se duplicará.');
    } finally {
      setEnviando(false);
    }
  }

  const total = cot?.total ?? 0;
  const valorRecibido = leerPesos(recibido) ?? total;
  const cambio = cambioEfectivo(total, valorRecibido);

  return (
    <>
      <div class="titulo-vista"><div style="display:flex;align-items:center;gap:14px">
        <button type="button" class="btn btn--secundario" onClick={alVolver}><Ico id="atras" clase="ico--s" />Volver</button>
        <h1>Nueva entrada · {habitacion.numero}</h1>
      </div></div>
      <div class="asistente">{PASOS.map((t, i) => <>
        {i > 0 && <div class={`asistente__linea${paso > i ? ' asistente__linea--hecha' : ''}`}><span /></div>}
        <div class={`asistente__paso${paso === i + 1 ? ' asistente__paso--activo' : paso > i + 1 ? ' asistente__paso--hecho' : ''}`}>
          <span class="asistente__num">{paso > i + 1 ? <Ico id="check" clase="ico--s" /> : i + 1}</span><span class="asistente__txt">{t}</span>
        </div>
      </>)}</div>

      <div class="pila">
        {paso === 1 && <section class="tarjeta">
          <div class="tarjeta__cab"><h2>Datos del titular</h2></div>
          <p class="ayuda">Solo se registra a quien toma la habitación. El documento es opcional.</p>
          <div class="form-rejilla form-rejilla--2">
            <div class={`campo${err('nombre') ? ' campo--error' : ''}`}><label for="h-nombre">Nombre completo <span class="req">*</span></label>
              <input id="h-nombre" autocomplete="off" value={h.nombre} onInput={(e) => campo('nombre', (e.target as HTMLInputElement).value)} />
              {err('nombre') && <span class="campo__error">{err('nombre')}</span>}</div>
            <div class={`campo${err('numeroDocumento') ? ' campo--error' : ''}`}><label for="h-doc">Documento</label>
              <div class="doble">
                <select aria-label="Tipo de documento" value={h.tipoDocumento} onChange={(e) => campo('tipoDocumento', (e.target as HTMLSelectElement).value)}>
                  <option value="">Sin documento</option>
                  {TIPOS_DOCUMENTO.map(([v, t]) => <option value={v}>{t}</option>)}
                </select>
                <input id="h-doc" autocomplete="off" disabled={!h.tipoDocumento} value={h.numeroDocumento}
                  onInput={(e) => campo('numeroDocumento', (e.target as HTMLInputElement).value)} />
              </div>
              {err('numeroDocumento') && <span class="campo__error">{err('numeroDocumento')}</span>}</div>
            <div class={`campo${err('nacionalidad') ? ' campo--error' : ''}`}><label for="h-nac">Nacionalidad <span class="req">*</span></label>
              <input id="h-nac" autocomplete="off" value={h.nacionalidad} onInput={(e) => campo('nacionalidad', (e.target as HTMLInputElement).value)} />
              {err('nacionalidad') && <span class="campo__error">{err('nacionalidad')}</span>}</div>
            <div class={`campo${err('telefono') ? ' campo--error' : ''}`}><label for="h-tel">Celular (opcional)</label>
              <input id="h-tel" inputmode="tel" autocomplete="off" placeholder="Ej. 300 123 4567" value={h.telefono}
                onInput={(e) => campo('telefono', (e.target as HTMLInputElement).value)} />
              {err('telefono') && <span class="campo__error">{err('telefono')}</span>}</div>
          </div>
          <label class="casilla"><input type="checkbox" checked={h.esMenor} onChange={(e) => setH({ ...h, esMenor: (e.target as HTMLInputElement).checked, acompanante: false })} />
            <span>Es menor de edad</span></label>
          {h.esMenor && <label class={`casilla casilla--aviso${err('acompanante') ? ' casilla--error' : ''}`}>
            <input type="checkbox" checked={h.acompanante} onChange={(e) => campo('acompanante', (e.target as HTMLInputElement).checked)} />
            <span>Verifiqué el registro civil y que viene con su padre, madre o tutor.</span></label>}
          {err('acompanante') && <span class="campo__error">{err('acompanante')}</span>}
          <label class={`casilla casilla--fuerte${err('autorizo') ? ' casilla--error' : ''}`}>
            <input type="checkbox" checked={h.autorizo} onChange={(e) => campo('autorizo', (e.target as HTMLInputElement).checked)} />
            <span>Le leí el aviso de privacidad ({AVISO_VERSION}) y <b>el huésped autorizó</b> el uso de sus datos.</span></label>
          {err('autorizo') && <span class="campo__error">{err('autorizo')}</span>}
        </section>}

        {paso === 2 && <PasoServicio habitacion={habitacion} servicio={servicio} alCambiar={setServicio} cot={cot} error={errorCot} reglas={reglas} tarifas={tarifas} />}

        {paso === 3 && cot && <div class="rejilla rejilla--2">
          <section class="tarjeta tarjeta--crema"><div class="tarjeta__cab"><h2>Resumen</h2></div>
            <dl class="kv">
              <dt>Huésped</dt><dd>{h.nombre.trim()}</dd>
              {h.tipoDocumento && <><dt>Documento</dt><dd>{h.tipoDocumento} {enmascarar(h.numeroDocumento)}</dd></>}
              <dt>Habitación</dt><dd>{habitacion.numero} · {habitacion.tipo === 'AIRE' ? 'Aire' : 'Ventilador'}</dd>
              <dt>Servicio</dt><dd>{servicio.modalidad === 'NOCHE' ? `${servicio.noches} ${servicio.noches === 1 ? 'noche' : 'noches'}` : '3 horas'} · {servicio.personas} {servicio.personas === 1 ? 'persona' : 'personas'}</dd>
              {servicio.tardio && <><dt>Entró</dt><dd>{fechaReporte(`${servicio.entrada}:00-05:00`)} a las {horaBogota(`${servicio.entrada}:00-05:00`)} (registro tardío)</dd></>}
              <dt>Sale</dt><dd>{textoSalida(cot.salida_prevista_en, hoyBogota())}</dd>
            </dl>
            {cot.descuento > 0 && <>
              <div class="fila"><div class="fila__txt"><div class="fila__concepto">Tarifa</div></div><div class="fila__valor">{pesos(cot.tarifa)}</div></div>
              <div class="fila"><div class="fila__txt"><div class="fila__concepto">Descuento</div></div><div class="fila__valor">−{pesos(cot.descuento)}</div></div>
            </>}
            <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Total</div></div><div class="fila__valor">{pesos(total)}</div></div>
          </section>
          <section class="tarjeta"><div class="tarjeta__cab"><h2>Pago</h2></div>
            <div class="segmentado">{FORMAS.filter(([f]) => f !== 'AL_SALIR' || cot.permite_pago_al_salir).map(([f, t]) =>
              <button type="button" class="opcion" aria-pressed={forma === f} onClick={() => setForma(f)}>{t}</button>)}</div>
            <p class="ayuda">{cot.permite_pago_al_salir ? 'Una noche se puede cobrar al salir.' : 'Se cobra por adelantado.'} Nadie sale debiendo.</p>
            {forma === 'EFECTIVO' && <>
              <div class="campo"><label for="recibido">Valor recibido</label>
                <input id="recibido" inputmode="numeric" autocomplete="off" placeholder={String(total)} value={recibido}
                  onInput={(e) => setRecibido((e.target as HTMLInputElement).value)} /></div>
              <div class={`saldo ${cambio.tipo === 'abono' ? 'saldo--aviso' : 'saldo--ok'}`}><div>
                <b>{cambio.tipo === 'vueltas' ? 'Vueltas' : cambio.tipo === 'abono' ? 'Queda debiendo' : 'Pago exacto'}</b>
                <p>{cambio.tipo === 'abono' ? `Se registra un abono de ${pesos(valorRecibido)}.` : `Entran ${pesos(total)} a la caja.`}</p>
              </div><strong>{pesos(cambio.valor)}</strong></div>
            </>}
            {(forma === 'NEQUI' || forma === 'BANCOLOMBIA') && <p class="ayuda">Queda «por verificar» hasta que la administración confirme que llegó. La habitación se entrega igual.</p>}
            {forma === 'AL_SALIR' && <p class="ayuda">Se cobran {pesos(total)} al salir, junto con lo que consuma.</p>}
          </section>
        </div>}

        {error && <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
      </div>

      <div class="pie-form">
        <button type="button" class="btn btn--suave btn--l" onClick={() => (paso === 1 ? alVolver() : setPaso(paso - 1))}>{paso === 1 ? 'Cancelar' : 'Atrás'}</button>
        {paso < 3
          ? <button type="button" class="btn btn--primario btn--l" disabled={paso === 2 && !cot} onClick={siguiente}>Siguiente <Ico id="adelante" clase="ico--s" /></button>
          : <button type="button" class="btn btn--primario btn--l" disabled={enviando} onClick={registrar}><Ico id="check" clase="ico--s" />{enviando ? 'Registrando…' : 'Registrar entrada'}</button>}
      </div>
    </>
  );
}
