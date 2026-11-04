// Caja del turno (TICKET-03, FR-11): el número que importa es cuánta plata debe haber
// ahora en la caja (RN-10). TICKET-10: «Salió plata» y «Lo de este turno». TICKET-11:
// «Entregar turno». Presentación del BOCETO 06.
//
// Esta pantalla arma piezas: el estado vive en dos hooks (los datos del turno y qué
// ventana está abierta) y las cifras las calcula `caja.ts`, que se prueba sin navegador.
import { useEffect, useState } from 'preact/hooks';
import { api, type Turno } from '../api.ts';
import { horaBogota, pesos, puedeAnular } from '../logica.ts';
import { filaTurno, horarioTurno, lineasCaja, ultimoDeCadaTipo, type FilaTurno } from '../caja.ts';
import { quienPidio } from '../lavanderia.ts';
import { useDatosCaja } from '../hooks/useDatosCaja.ts';
import { usePanelesCaja } from '../hooks/usePanelesCaja.ts';
import { SalidaDinero } from './SalidaDinero.tsx';
import { VentaContado } from './VentaContado.tsx';
import { EntregarLavanderia } from './EntregarLavanderia.tsx';
import { LavanderiaExterna } from './LavanderiaExterna.tsx';
import { CobrarDeudaLavanderia } from './CobrarDeudaLavanderia.tsx';
import { EntregarTurno } from './EntregarTurno.tsx';
import { Anular } from './Anular.tsx';
import { TurnoActual } from './TurnoActual.tsx';
import { ResumenTurno } from './ResumenTurno.tsx';
import { HistorialTurnos } from './HistorialTurnos.tsx';
import { Ico } from './Ico.tsx';
import { icoMovimiento } from '../presentacion.ts';

const salioTexto = (salidas: number) => (salidas ? ` − salió ${pesos(salidas)}` : '');

/** `recarga` cambia con cada evento en vivo: la caja se vuelve a pedir sin recargar la página. */
export function Caja({ recarga = 0, usuario, esAdmin = false, alAvisar, alEntregar, alVerTodos }: {
  recarga?: number; usuario?: string; esAdmin?: boolean;
  alAvisar?: (texto: string) => void; alEntregar?: (texto: string) => void; alVerTodos?: () => void;
}) {
  const datos = useDatosCaja(recarga);
  const pan = usePanelesCaja();
  // El historial de turnos es solo de administración: /turnos responde 403 a recepción.
  const [turnos, setTurnos] = useState<Turno[]>([]);

  useEffect(() => {
    if (!esAdmin) { setTurnos([]); return; }
    api.turnos(0, 8).then((r) => setTurnos(r.items)).catch(() => setTurnos([]));
  }, [esAdmin, recarga]);

  const { turno } = datos;
  if (datos.error) return <div class="nota" role="alert"><Ico id="info" clase="ico--s" /><p>{datos.error}</p></div>;
  if (!turno) return null;

  const c = turno.caja;
  const porRecibir = turno.estado === 'POR_RECIBIR';
  const { dia, noche } = ultimoDeCadaTipo(turnos);
  const filas: FilaTurno[] = turnos.map(filaTurno);
  // Lo registrado desde esta pantalla recarga sus propios datos y avisa arriba.
  const listo = (texto: string) => { pan.ninguna(); datos.recargar(); alAvisar?.(texto); };

  return (
    <div class="caja-vista">
      <div class="titulo-vista titulo-vista--entre">
        <div>
          <h1><span class="titulo-vista__ico"><Ico id="caja" clase="ico--l" /></span>Caja por turno</h1>
          <p>Control de ingresos y egresos de caja por turno de trabajo.</p>
        </div>
        {turno.estado === 'ABIERTO' && turno.responsable === usuario && (
          <button type="button" class="btn btn--primario btn--l" onClick={() => pan.abrir('entregar-turno')}>
            <Ico id="check" clase="ico--s" />Entregar turno
          </button>
        )}
      </div>

      <div class="caja-columnas">
        <div class="caja-columnas__principal">
          <TurnoActual turno={turno} lineas={lineasCaja(turno)} desde={horaBogota(turno.inicio_en)}>
            <div class="turno-actual__nota">
              <h3>{porRecibir ? 'Lo que dejaron' : 'Cómo se llega al esperado'}</h3>
              <p>
                {porRecibir
                  ? `${turno.recibido_de ?? 'El turno anterior'} entregó ${pesos(turno.base_entregada)}; falta que alguien lo reciba.`
                  : `Recibió ${pesos(c.base_recibida)} + cobró en efectivo ${pesos(c.efectivo)}${salioTexto(c.salidas)}.`}
              </p>
              {turno.cierre?.motivo_diferencia && <>
                <h3>Motivo de la diferencia</h3>
                <p class="turno-actual__motivo">{turno.cierre.motivo_diferencia}</p>
              </>}
              <p class="ayuda">
                <Ico id="transferencia" clase="ico--xs" /> Transferencias (no están en la caja): <b>{pesos(c.transferencias)}</b>
                {c.por_verificar_cantidad > 0 && ` · ${c.por_verificar_cantidad} por verificar`}
              </p>
            </div>
          </TurnoActual>

          {/* Los tres movimientos que recepción registra desde la caja. La venta de contado
              y la lavandería de afuera entran al efectivo, así que sin ellas el «debe haber»
              queda corto y el turno cierra con una diferencia que no es de quien lo entrega.
              El servidor las acepta de recepción: POST /ventas y POST /lavanderia. */}
          {!porRecibir && <div class="caja-acciones">
            <button type="button" class="btn btn--secundario btn--l" onClick={() => pan.abrir('vender')}><Ico id="vitrina" clase="ico--s" />Venta de contado</button>
            <button type="button" class="btn btn--secundario btn--l" onClick={() => pan.abrir('salio')}><Ico id="baja" clase="ico--s" />Salió plata</button>
            <button type="button" class="btn btn--secundario btn--l" onClick={() => pan.abrir('lavanderia-externa')}><Ico id="lavanderia" clase="ico--s" />Lavandería de afuera</button>
          </div>}
        </div>

        <aside class="caja-columnas__lateral">
          <ResumenTurno turno={dia} tipo="DIA" horario={dia && horarioTurno(dia)} />
          <ResumenTurno turno={noche} tipo="NOCHE" horario={noche && horarioTurno(noche)} />
        </aside>
      </div>

      {datos.deudas.length > 0 && <section class="tarjeta"><div class="tarjeta__cab"><h2><Ico id="alerta" clase="ico--s" />Deudas de lavandería</h2></div>
        <p class="ayuda">Personas de afuera que se llevaron la ropa sin pagar, con la autorización de quien entregó.</p>
        {datos.deudas.map((p) => <div class="mov" key={p.id}>
          <div class="mov__txt"><div class="mov__titulo">{quienPidio(p)} · {p.detalle}</div>
            <div class="mov__detalle">Autorizó {p.sin_pago_autorizado_por}</div></div>
          <div class="mov__der"><span class="mov__valor negativo">{pesos(p.por_cobrar ?? 0)}</span>
            {!porRecibir && <button type="button" class="btn btn--secundario btn--mini" onClick={() => pan.cobrarDeuda(p)}>Cobrar</button>}</div>
        </div>)}
      </section>}

      {!porRecibir && datos.lavanderia.length > 0 && <section class="tarjeta"><div class="tarjeta__cab"><h2><Ico id="lavanderia" clase="ico--s" />Lavandería por entregar</h2></div>
        {datos.lavanderia.map((p) => <div class="mov" key={p.id}>
          <div class="mov__txt"><div class="mov__titulo">{quienPidio(p)} · {p.detalle}</div>
            <div class="mov__detalle">Recibida {horaBogota(p.registrado_en)} · {p.registrado_por}</div></div>
          <div class="mov__der"><span class="mov__valor">{pesos(p.total)}</span>
            <button type="button" class="btn btn--secundario btn--mini" onClick={() => pan.entregarRopa(p)}>Entregar</button></div>
        </div>)}
      </section>}

      {!porRecibir && <section class="tarjeta"><div class="tarjeta__cab"><h2>Lo de este turno</h2></div>
        {datos.lineas.length === 0 ? <p class="vacio">Todavía no hay cobros ni salidas en este turno.</p> : datos.lineas.map((l) => (
          <div class={`mov${l.anulado ? ' mov--anulado' : ''}`} key={l.id}>
            <span class="mov__ico"><Ico id={icoMovimiento(l)} clase="ico--s" /></span>
            <div class="mov__txt"><div class="mov__titulo">{l.concepto}</div>
              <div class="mov__detalle">{horaBogota(l.hora)} · {l.por}{!l.enCaja ? ' · no entra a la caja' : ''}{l.anulado ? ' · anulado' : ''}</div></div>
            <div class="mov__der"><span class={`mov__valor${l.valor < 0 ? ' negativo' : ''}`}>{l.valor < 0 ? '−' : ''}{pesos(Math.abs(l.valor))}</span>
              {l.estado === 'POR_VERIFICAR' && <span class="pill pill--aviso">Por verificar</span>}
              {l.estado === 'RECHAZADO' && <span class="pill pill--alerta">No llegó</span>}
              {l.anulado && <span class="pill pill--neutro">Anulado</span>}
              {puedeAnular(l, esAdmin) && <button type="button" class="accion-icono accion-icono--rojo" aria-label={`Anular ${l.concepto}`} title="Anular"
                onClick={() => pan.anular({ id: l.id, origen: l.origen, concepto: l.concepto, valor: l.valor })}><Ico id="papelera" clase="ico--s" /></button>}</div>
          </div>
        ))}
      </section>}

      {esAdmin && <HistorialTurnos filas={filas} alVerTodos={alVerTodos} />}

      {turno.estado === 'ABIERTO' && turno.responsable === usuario && (
        <p class="ayuda" style="text-align:center">Entregue al terminar su horario, cuando llegue quien lo recibe.</p>
      )}

      {pan.ventana === 'lavanderia-externa' && <LavanderiaExterna alCerrar={pan.ninguna} alRegistrar={listo} />}
      {pan.cobrandoDeuda && <CobrarDeudaLavanderia pedido={pan.cobrandoDeuda} alCerrar={pan.ninguna} alCobrar={listo} />}
      {pan.entregandoRopa && <EntregarLavanderia pedido={pan.entregandoRopa} alCerrar={pan.ninguna} alEntregar={listo} />}
      {pan.ventana === 'vender' && <VentaContado alCerrar={pan.ninguna} alRegistrar={listo} />}
      {pan.ventana === 'salio' && <SalidaDinero debeHaber={c.debe_haber} alCerrar={pan.ninguna} alRegistrar={listo} />}
      {pan.anulando && <Anular que={pan.anulando} alCerrar={pan.ninguna} alAnular={listo} />}
      {pan.ventana === 'entregar-turno' && <EntregarTurno turno={turno} alCerrar={pan.ninguna}
        alEntregar={(texto) => { pan.ninguna(); alEntregar?.(texto); }} />}
    </div>
  );
}
