// Paso «Habitación y servicio» (TICKET-02, FR-04): modalidad, personas, noches y descuento; el precio lo calcula el servidor.
import type { ComponentChildren } from 'preact';
import type { Cotizacion, Habitacion } from '../api.ts';
import { ajustarPersonas, hoyBogota, maxPersonas, pesos, textoSalida, type Modalidad } from '../logica.ts';
import { Ico } from './Ico.tsx';
import { errorTardio, limitesTardio } from '../tardio.ts';
import type { Reglas, Tarifa } from '../ajustes.ts';
import { ayudaPersonas, leerDescuento, textoDescuento } from '../textosConfig.ts';
import { cuantos, notaCobro, notaFranja } from '../presentacion.ts';

/** `tardio` y `entrada` (hora real en Bogotá, «AAAA-MM-DDTHH:mm») son para pasar lo anotado en el talonario (ADR-010). */
/** `valorDescuento`: lo que recepción escribe por noche (RN-05: hasta el máximo de Ajustes). */
export interface Servicio { modalidad: Modalidad; personas: number; noches: number; descuento: boolean; valorDescuento: string; tardio: boolean; entrada: string }
export const SERVICIO_INICIAL: Servicio = { modalidad: 'NOCHE', personas: 1, noches: 1, descuento: false, valorDescuento: '', tardio: false, entrada: '' };

const MODALIDADES: Array<[Modalidad, string]> = [['NOCHE', 'Noche'], ['TRES_HORAS', '3 horas']];

/** Al pasar a tres horas: máximo 2 personas y sin descuento. */
export function cambiarModalidad(s: Servicio, m: Modalidad): Servicio {
  return { ...s, modalidad: m, personas: ajustarPersonas(s.personas, m), descuento: m === 'NOCHE' && s.descuento };
}

function Contador({ etiqueta, valor, uno, varios, max, alCambiar, children }: {
  etiqueta: string; valor: number; uno: string; varios: string; max: number; alCambiar: (n: number) => void; children?: ComponentChildren;
}) {
  return <div class="campo"><span>{etiqueta}</span>
    <div class="contador">
      <button type="button" aria-label={`Restar ${uno}`} disabled={valor <= 1} onClick={() => alCambiar(valor - 1)}>−</button>
      <output>{cuantos(valor, uno, varios)}</output>
      <button type="button" aria-label={`Sumar ${uno}`} disabled={valor >= max} onClick={() => alCambiar(valor + 1)}>+</button>
    </div>
    {children}
  </div>;
}

/** RN-05: sin descuento o con uno que recepción escribe, hasta el máximo configurado. */
function CampoDescuento({ s, alCambiar, reglas }: { s: Servicio; alCambiar: (s: Servicio) => void; reglas: Pick<Reglas, 'descuento_noche'> | null }) {
  const texto = textoDescuento(reglas);
  if (s.modalidad !== 'NOCHE' || !texto) return null;
  const error = s.descuento ? leerDescuento(s.valorDescuento, reglas).error : null;
  const inicial = reglas ? String(reglas.descuento_noche) : '';
  return <>
    <div class="campo"><span>¿El cliente pidió rebaja?</span>
      <div class="segmentado">
        <button type="button" class="opcion" aria-pressed={!s.descuento} onClick={() => alCambiar({ ...s, descuento: false })}>Sin descuento</button>
        <button type="button" class="opcion" aria-pressed={s.descuento}
          onClick={() => alCambiar({ ...s, descuento: true, valorDescuento: s.valorDescuento || inicial })}>{texto}</button>
      </div>
    </div>
    {s.descuento && <div class="campo">
      <label htmlFor="valor-descuento">¿Cuánto por noche?</label>
      <input id="valor-descuento" inputmode="numeric" autocomplete="off" value={s.valorDescuento} aria-invalid={!!error}
        onInput={(e) => alCambiar({ ...s, valorDescuento: (e.target as HTMLInputElement).value })} />
      {error ? <span class="campo__error">{error}</span>
        : <span class="ayuda">{reglas ? `Puede dar menos, pero no más de ${pesos(reglas.descuento_noche)} por noche.` : 'No puede pasar del máximo por noche.'}</span>}
    </div>}
  </>;
}

/** ADR-010: entrada anotada en el talonario cuando el sistema no funcionaba. */
function CampoTardio({ s, alCambiar }: { s: Servicio; alCambiar: (s: Servicio) => void }) {
  const ahora = Date.now();
  const limites = limitesTardio(ahora);
  const error = s.tardio ? errorTardio(s.entrada, ahora) : null;
  return <>
    <label class="casilla">
      <input type="checkbox" checked={s.tardio} onChange={(e) => alCambiar({ ...s, tardio: (e.target as HTMLInputElement).checked })} />
      <span>Viene del talonario: entró cuando el sistema no funcionaba (registro tardío)</span></label>
    {s.tardio && <div class="campo">
      <label htmlFor="entrada-real">Día y hora real de entrada (como está en el talonario)</label>
      <input id="entrada-real" type="datetime-local" min={limites.min} max={limites.max} value={s.entrada} aria-invalid={!!error}
        onInput={(e) => alCambiar({ ...s, entrada: (e.target as HTMLInputElement).value })} />
      {error ? <span class="campo__error">{error}</span>
        : <span class="ayuda">El precio y la salida se calculan con esa hora. Quedará marcado como registro tardío, con su usuario y la hora en que lo digita.</span>}
    </div>}
  </>;
}

function ResumenCotizacion({ cot, modalidad }: { cot: Cotizacion; modalidad: Modalidad }) {
  return <>
    <div class="fila"><div class="fila__txt"><div class="fila__concepto">Tarifa</div></div><div class="fila__valor">{pesos(cot.tarifa)}</div></div>
    {cot.descuento > 0 && <div class="fila"><div class="fila__txt"><div class="fila__concepto">Descuento</div></div><div class="fila__valor">−{pesos(cot.descuento)}</div></div>}
    <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Total</div></div><div class="fila__valor">{pesos(cot.total)}</div></div>
    <p class="ayuda" style="margin-top:10px"><b>Sale {textoSalida(cot.salida_prevista_en, hoyBogota())}</b>
      {notaFranja(cot.franja_salida)}{' '}{notaCobro(cot.permite_pago_al_salir, modalidad)}</p>
  </>;
}

/** `reglas` y `tarifas` (de Ajustes) dan los importes de las ayudas; mientras no lleguen, los textos no llevan importe. */
export function PasoServicio({ habitacion, servicio: s, alCambiar, cot, error, reglas, tarifas }: {
  habitacion: Habitacion; servicio: Servicio; alCambiar: (s: Servicio) => void; cot: Cotizacion | null; error: string;
  reglas: Pick<Reglas, 'descuento_noche'> | null; tarifas: Tarifa[] | null;
}) {
  return (
    <>
      <section class="tarjeta">
        <div class="tarjeta__cab"><h2>Habitación {habitacion.numero}</h2><span class="ayuda">{habitacion.tipo === 'AIRE' ? 'Aire acondicionado' : 'Ventilador'}</span></div>
        <div class="campo"><span>Tipo de tarifa</span>
          <div class="segmentado">{MODALIDADES.map(([m, t]) =>
            <button key={m} type="button" class="opcion" aria-pressed={s.modalidad === m} onClick={() => alCambiar(cambiarModalidad(s, m))}>{t}</button>)}</div>
        </div>
        <div class="form-rejilla form-rejilla--2">
          <Contador etiqueta="Personas" valor={s.personas} uno="persona" varios="personas" max={maxPersonas(s.modalidad)} alCambiar={(personas) => alCambiar({ ...s, personas })}>
            <span class="ayuda">{ayudaPersonas(s.modalidad, habitacion.tipo, tarifas)}</span>
          </Contador>
          {s.modalidad === 'NOCHE' && <Contador etiqueta="Noches" valor={s.noches} uno="noche" varios="noches" max={30} alCambiar={(noches) => alCambiar({ ...s, noches })} />}
        </div>
        <CampoDescuento s={s} alCambiar={alCambiar} reglas={reglas} />
        <CampoTardio s={s} alCambiar={alCambiar} />
      </section>

      <section class="tarjeta tarjeta--crema" aria-live="polite">
        {error ? <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div> : cot && <ResumenCotizacion cot={cot} modalidad={s.modalidad} />}
      </section>
    </>
  );
}
