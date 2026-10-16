// Paso «Habitación y servicio» (TICKET-02, FR-04): modalidad, personas, noches y descuento; el precio lo calcula el servidor.
import type { Cotizacion, Habitacion } from '../api.ts';
import { ajustarPersonas, hoyBogota, maxPersonas, pesos, textoSalida, type Modalidad } from '../logica.ts';
import { Ico } from './Ico.tsx';

export interface Servicio { modalidad: Modalidad; personas: number; noches: number; descuento: boolean }
export const SERVICIO_INICIAL: Servicio = { modalidad: 'NOCHE', personas: 1, noches: 1, descuento: false };

const MODALIDADES: Array<[Modalidad, string]> = [['NOCHE', 'Noche'], ['TRES_HORAS', '3 horas']];

/** Al pasar a tres horas: máximo 2 personas y sin descuento. */
export function cambiarModalidad(s: Servicio, m: Modalidad): Servicio {
  return { ...s, modalidad: m, personas: ajustarPersonas(s.personas, m), descuento: m === 'NOCHE' && s.descuento };
}

export function PasoServicio({ habitacion, servicio: s, alCambiar, cot, error }: {
  habitacion: Habitacion; servicio: Servicio; alCambiar: (s: Servicio) => void; cot: Cotizacion | null; error: string;
}) {
  const max = maxPersonas(s.modalidad);
  return (
    <>
      <section class="tarjeta">
        <div class="tarjeta__cab"><h2>Habitación {habitacion.numero}</h2><span class="ayuda">{habitacion.tipo === 'AIRE' ? 'Aire acondicionado' : 'Ventilador'}</span></div>
        <div class="campo"><span>Tipo de tarifa</span>
          <div class="segmentado">{MODALIDADES.map(([m, t]) =>
            <button type="button" class="opcion" aria-pressed={s.modalidad === m} onClick={() => alCambiar(cambiarModalidad(s, m))}>{t}</button>)}</div>
        </div>
        <div class="form-rejilla form-rejilla--2">
          <div class="campo"><span>Personas</span>
            <div class="contador">
              <button type="button" aria-label="Restar persona" disabled={s.personas <= 1} onClick={() => alCambiar({ ...s, personas: s.personas - 1 })}>−</button>
              <output>{s.personas} {s.personas === 1 ? 'persona' : 'personas'}</output>
              <button type="button" aria-label="Sumar persona" disabled={s.personas >= max} onClick={() => alCambiar({ ...s, personas: s.personas + 1 })}>+</button>
            </div>
            <span class="ayuda">{s.modalidad === 'NOCHE' ? 'Máximo 3: la tercera paga $25.000. Con 4, ofrezca dos habitaciones.' : 'En tres horas entran máximo 2, sin adicional.'}</span>
          </div>
          {s.modalidad === 'NOCHE' && <div class="campo"><span>Noches</span>
            <div class="contador">
              <button type="button" aria-label="Restar noche" disabled={s.noches <= 1} onClick={() => alCambiar({ ...s, noches: s.noches - 1 })}>−</button>
              <output>{s.noches} {s.noches === 1 ? 'noche' : 'noches'}</output>
              <button type="button" aria-label="Sumar noche" disabled={s.noches >= 30} onClick={() => alCambiar({ ...s, noches: s.noches + 1 })}>+</button>
            </div>
          </div>}
        </div>
        {s.modalidad === 'NOCHE' && <div class="campo"><span>¿El cliente pidió rebaja?</span>
          <div class="segmentado">
            <button type="button" class="opcion" aria-pressed={!s.descuento} onClick={() => alCambiar({ ...s, descuento: false })}>Sin descuento</button>
            <button type="button" class="opcion" aria-pressed={s.descuento} onClick={() => alCambiar({ ...s, descuento: true })}>− $5.000 por noche</button>
          </div>
        </div>}
      </section>

      <section class="tarjeta tarjeta--crema" aria-live="polite">
        {error ? <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div> : cot && <>
          <div class="fila"><div class="fila__txt"><div class="fila__concepto">Tarifa</div></div><div class="fila__valor">{pesos(cot.tarifa)}</div></div>
          {cot.descuento > 0 && <div class="fila"><div class="fila__txt"><div class="fila__concepto">Descuento</div></div><div class="fila__valor">−{pesos(cot.descuento)}</div></div>}
          <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Total</div></div><div class="fila__valor">{pesos(cot.total)}</div></div>
          <p class="ayuda" style="margin-top:10px"><b>Sale {textoSalida(cot.salida_prevista_en, hoyBogota())}</b>
            {cot.franja_salida === 'VEINTICUATRO_HORAS' ? ' (entró de 6:01 a 11:59 a. m.: 24 horas).' : cot.franja_salida === 'MADRUGADA_MISMO_DIA' ? ' (entró de madrugada: sale hoy al mediodía).' : ''}
            {' '}{cot.permite_pago_al_salir ? 'Una noche se puede cobrar al salir.' : s.modalidad === 'NOCHE' ? 'Varias noches se cobran por adelantado.' : ''}</p>
        </>}
      </section>
    </>
  );
}
