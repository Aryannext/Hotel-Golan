// Paso «Habitación y servicio» (TICKET-02, FR-04): precio y salida en vivo, calculados por el servidor.
// El registro de la entrada (paso 3) llega en el TICKET-04.
import { useEffect, useState } from 'preact/hooks';
import { api, type Cotizacion, type Habitacion } from '../api.ts';
import { ajustarPersonas, hoyBogota, maxPersonas, pesos, textoSalida, type Modalidad } from '../logica.ts';
import { Ico } from './Ico.tsx';

const MODALIDADES: Array<[Modalidad, string]> = [['NOCHE', 'Noche'], ['TRES_HORAS', '3 horas']];

export function Cotizar({ habitacion, alVolver }: { habitacion: Habitacion; alVolver: () => void }) {
  const [modalidad, setModalidad] = useState<Modalidad>('NOCHE');
  const [personas, setPersonas] = useState(1);
  const [noches, setNoches] = useState(1);
  const [descuento, setDescuento] = useState(false);
  const [cot, setCot] = useState<Cotizacion | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    api.cotizar({ habitacion_numero: habitacion.numero, modalidad, personas, noches: modalidad === 'NOCHE' ? noches : 1, aplicar_descuento: modalidad === 'NOCHE' && descuento })
      .then((c) => { if (vigente) { setCot(c); setError(''); } })
      .catch((e: Error) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [habitacion.numero, modalidad, personas, noches, descuento]);

  const elegirModalidad = (m: Modalidad) => { setModalidad(m); setPersonas((p) => ajustarPersonas(p, m)); if (m !== 'NOCHE') setDescuento(false); };
  const max = maxPersonas(modalidad);

  return (
    <>
      <div class="titulo-vista"><div style="display:flex;align-items:center;gap:14px">
        <button type="button" class="btn btn--secundario" onClick={alVolver}><Ico id="atras" clase="ico--s" />Volver</button>
        <h1>Habitación {habitacion.numero}</h1>
      </div></div>
      <section class="tarjeta">
        <div class="tarjeta__cab"><h2>Habitación y servicio</h2><span class="ayuda">{habitacion.tipo === 'AIRE' ? 'Aire acondicionado' : 'Ventilador'}</span></div>
        <div class="campo"><span>Tipo de tarifa</span>
          <div class="segmentado">{MODALIDADES.map(([m, t]) =>
            <button type="button" class="opcion" aria-pressed={modalidad === m} onClick={() => elegirModalidad(m)}>{t}</button>)}</div>
        </div>
        <div class="form-rejilla form-rejilla--2">
          <div class="campo"><span>Personas</span>
            <div class="contador">
              <button type="button" aria-label="Restar persona" disabled={personas <= 1} onClick={() => setPersonas(personas - 1)}>−</button>
              <output>{personas} {personas === 1 ? 'persona' : 'personas'}</output>
              <button type="button" aria-label="Sumar persona" disabled={personas >= max} onClick={() => setPersonas(personas + 1)}>+</button>
            </div>
            <span class="ayuda">{modalidad === 'NOCHE' ? 'Máximo 3: la tercera paga $25.000. Con 4, ofrezca dos habitaciones.' : 'En tres horas entran máximo 2, sin adicional.'}</span>
          </div>
          {modalidad === 'NOCHE' && <div class="campo"><span>Noches</span>
            <div class="contador">
              <button type="button" aria-label="Restar noche" disabled={noches <= 1} onClick={() => setNoches(noches - 1)}>−</button>
              <output>{noches} {noches === 1 ? 'noche' : 'noches'}</output>
              <button type="button" aria-label="Sumar noche" disabled={noches >= 30} onClick={() => setNoches(noches + 1)}>+</button>
            </div>
          </div>}
        </div>
        {modalidad === 'NOCHE' && <div class="campo"><span>¿El cliente pidió rebaja?</span>
          <div class="segmentado">
            <button type="button" class="opcion" aria-pressed={!descuento} onClick={() => setDescuento(false)}>Sin descuento</button>
            <button type="button" class="opcion" aria-pressed={descuento} onClick={() => setDescuento(true)}>− $5.000 por noche</button>
          </div>
        </div>}
      </section>

      <section class="tarjeta tarjeta--crema" aria-live="polite" style="margin-top:16px">
        {error ? <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div> : cot && <>
          <div class="fila"><div class="fila__txt"><div class="fila__concepto">Tarifa</div></div><div class="fila__valor">{pesos(cot.tarifa)}</div></div>
          {cot.descuento > 0 && <div class="fila"><div class="fila__txt"><div class="fila__concepto">Descuento</div></div><div class="fila__valor">−{pesos(cot.descuento)}</div></div>}
          <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Total</div></div><div class="fila__valor">{pesos(cot.total)}</div></div>
          <p class="ayuda" style="margin-top:10px"><b>Sale {textoSalida(cot.salida_prevista_en, hoyBogota())}</b>
            {cot.franja_salida === 'VEINTICUATRO_HORAS' ? ' (entró de 6:01 a 11:59 a. m.: 24 horas).' : cot.franja_salida === 'MADRUGADA_MISMO_DIA' ? ' (entró de madrugada: sale hoy al mediodía).' : ''}
            {' '}{cot.permite_pago_al_salir ? 'Una noche se puede cobrar al salir.' : modalidad === 'NOCHE' ? 'Varias noches se cobran por adelantado.' : ''}</p>
        </>}
      </section>
      <p class="ayuda" style="margin-top:12px">Registrar la entrada con estos datos se habilita en la siguiente entrega.</p>
    </>
  );
}
