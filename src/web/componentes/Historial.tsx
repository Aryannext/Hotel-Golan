import { useEffect, useState } from 'preact/hooks';
import { api, type ResumenDia, type Turno, type TurnoDetalle } from '../api.ts';
import { horaBogota, lineasDelTurno, pesos } from '../logica.ts';
import { diaHotelActual, errorRango, fechaReporte, textoAjuste } from '../reportes.ts';
import { pillEstadoPago } from '../presentacion.ts';
import { ProductosDelTurno, ProductosVendidos } from './ProductosVendidos.tsx';

const tipoTurno = (t: Turno['tipo']) => t === 'DIA' ? 'Día' : 'Noche';
const estadoTurno = (t: Turno) => ({ ABIERTO: 'En curso', CERRADO: 'Cerrado', POR_RECIBIR: 'Por recibir' })[t.estado];
const momento = (s: string) => `${fechaReporte(s)} · ${horaBogota(s)}`;
const mensajeError = (e: unknown) => e instanceof Error ? e.message : 'No se pudo cargar la consulta.';

function Importes({ filas }: { filas: Array<[string, number | null]> }) {
  return <dl class="historial__importes">{filas.map(([etiqueta, valor]) => <div key={etiqueta}>
    <dt>{etiqueta}</dt><dd>{valor === null ? 'Pendiente' : pesos(valor)}</dd>
  </div>)}</dl>;
}

function CifrasTurno({ turno: t }: { turno: Turno }) {
  return <Importes filas={[
    ['Base recibida', t.base_recibida], ['Cobros en efectivo', t.caja.efectivo], ['Transferencias', t.caja.transferencias],
    ['Salidas de caja', t.caja.salidas], ['Pago del turno', t.caja.pago_turno],
    ['Contado al entregar', t.cierre?.efectivo_contado ?? null], ['Diferencia al entregar', t.cierre?.diferencia ?? null],
  ]} />;
}

function Detalle({ id, recarga, alVolver }: { id: string; recarga: number; alVolver: () => void }) {
  const [turno, setTurno] = useState<TurnoDetalle | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError('');
    api.turno(id).then((t) => { if (vigente) setTurno(t); })
      .catch((e) => { if (vigente) { setError(mensajeError(e)); setTurno(null); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id, recarga]);
  const lineas = turno ? lineasDelTurno(turno.pagos, turno.movimientos_caja) : [];
  return <div class="historial">
    <button type="button" class="btn btn--secundario" onClick={alVolver}>Volver al historial</button>
    {cargando && <p><output>Cargando detalle…</output></p>}
    {error && <p class="nota nota--alerta" role="alert">{error}</p>}
    {turno && <>
      <section class="tarjeta">
        <h2>Turno de {tipoTurno(turno.tipo).toLowerCase()} · {turno.responsable ?? 'Sin recibir'}</h2>
        <p>{momento(turno.inicio_en)} → {turno.fin_en ? momento(turno.fin_en) : estadoTurno(turno)}</p>
        <p class="ayuda">Recibido de: {turno.recibido_de ?? 'Sin registro'}. Base entregada: {pesos(turno.base_entregada)}.</p>
        <CifrasTurno turno={turno} />
        <p class="ayuda">Transferencias por verificar: {turno.caja.por_verificar_cantidad}.</p>
        {turno.cierre ? <>
          <p>Pago del turno: <b>{turno.cierre.pago_tomado ? 'Sí lo tomó' : 'No lo tomó'}</b>.</p>
          <p>Esperado al entregar: <b>{pesos(turno.cierre.efectivo_esperado)}</b>. Entregó: <b>{turno.cierre.entregado_por}</b>.</p>
          {turno.cierre.motivo_diferencia && <p class="nota">Motivo de la diferencia: {turno.cierre.motivo_diferencia}</p>}
          {textoAjuste(turno.cierre) && <p class="nota nota--info">{textoAjuste(turno.cierre)}</p>}
          <p class="ayuda">El conteo y la diferencia conservan lo registrado al cerrar. Los totales de cobros y salidas reflejan las anulaciones posteriores.</p>
        </> : <p class="ayuda">Este turno todavía no tiene un conteo de entrega.</p>}
      </section>
      <ProductosDelTurno turnoId={id} recarga={recarga} />
      <section class="tarjeta"><h2>Cobros y salidas del turno</h2>
        {lineas.length === 0 ? <p class="vacio">No hay cobros ni salidas registrados.</p> : lineas.map((l) =>
          <div class={`mov${l.anulado ? ' mov--anulado' : ''}`} key={l.id}>
            <div class="mov__txt"><div class="mov__titulo">{l.concepto}</div>
              <div class="mov__detalle">{momento(l.hora)} · {l.por}{!l.enCaja ? ' · no entra a la caja' : ''}</div></div>
            <div class="mov__der"><span class="mov__valor">{pesos(l.valor)}</span>
              <PillLinea anulado={l.anulado} estado={l.estado} />
            </div>
          </div>)}
      </section>
    </>}
  </div>;
}

function Turnos({ recarga }: { recarga: number }) {
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState<{ items: Turno[]; total: number } | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError('');
    api.turnos(pagina * 20).then((r) => { if (vigente) setDatos(r); })
      .catch((e) => { if (vigente) { setError(mensajeError(e)); setDatos(null); } })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [pagina, recarga]);
  if (id) return <Detalle id={id} recarga={recarga} alVolver={() => setId(null)} />;
  return <div class="historial">
    {cargando && <p><output>Cargando turnos…</output></p>}
    {error && <p class="nota nota--alerta" role="alert">{error}</p>}
    {!cargando && datos && <>
      {datos.items.length === 0 && <p class="vacio">No hay turnos para mostrar.</p>}
      {datos.items.map((t) => <section class="tarjeta" key={t.id}>
        <div class="historial__cab"><div><h2>{tipoTurno(t.tipo)} · {fechaReporte(t.inicio_en)}</h2>
          <p>{t.responsable ?? 'Sin recibir'} · {horaBogota(t.inicio_en)} · {estadoTurno(t)}</p></div>
          <button type="button" class="btn btn--secundario" onClick={() => setId(t.id)}
            aria-label={`Ver detalle del turno de ${tipoTurno(t.tipo).toLowerCase()} del ${fechaReporte(t.inicio_en)}`}>Ver detalle</button>
        </div>
        <CifrasTurno turno={t} />
      </section>)}
      <nav class="historial__cab" aria-label="Páginas del historial">
        <button type="button" class="btn btn--secundario" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>{datos.total === 0 ? '0 turnos' : `${pagina * 20 + 1}–${pagina * 20 + datos.items.length} de ${datos.total}`}</span>
        <button type="button" class="btn btn--secundario" disabled={(pagina + 1) * 20 >= datos.total} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </nav>
    </>}
  </div>;
}

function Dias({ recarga }: { recarga: number }) {
  const [desde, setDesde] = useState(diaHotelActual);
  const [hasta, setHasta] = useState(diaHotelActual);
  const [consulta, setConsulta] = useState({ desde, hasta });
  const [dias, setDias] = useState<ResumenDia[] | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(''); setDias(null);
    api.reporteDias(consulta.desde, consulta.hasta).then((r) => { if (vigente) setDias(r.items); })
      .catch((e) => { if (vigente) setError(mensajeError(e)); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [consulta, recarga]);
  return <div class="historial">
    <form class="tarjeta historial__filtro" onSubmit={(ev) => {
      ev.preventDefault();
      const error = errorRango(desde, hasta);
      setError(error ?? '');
      if (!error) setConsulta({ desde, hasta });
    }}>
      <label class="campo"><span>Desde</span><input type="date" required value={desde} onInput={(ev) => setDesde(ev.currentTarget.value)} /></label>
      <label class="campo"><span>Hasta</span><input type="date" required value={hasta} min={desde} onInput={(ev) => setHasta(ev.currentTarget.value)} /></label>
      <button type="submit" class="btn btn--primario" disabled={cargando}>Consultar</button>
    </form>
    <p class="ayuda">Cada día reúne los turnos que comenzaron de 6:30 a. m. a 6:30 a. m. del día siguiente, hora de Colombia. Los turnos en curso tienen cifras parciales.</p>
    {cargando && <p><output>Consultando días…</output></p>}
    {error && <p class="nota nota--alerta" role="alert">{error}</p>}
    {!cargando && dias && <>
      <p>Consulta: {fechaReporte(consulta.desde)} al {fechaReporte(consulta.hasta)}.</p>
      {dias.length === 0 && <p class="vacio">No hay turnos recibidos en estas fechas.</p>}
      {dias.map((d) => <section class="tarjeta" key={d.dia}>
        <h2>Día del hotel · {fechaReporte(d.dia)}</h2>
        <p class="ayuda">{momento(d.desde)} → {momento(d.hasta)}</p>
        <p>{d.turnos.map((t) => `${tipoTurno(t.tipo)}: ${t.responsable}`).join(' · ')}</p>
        <Importes filas={[
          ['Cobros en efectivo', d.efectivo], ['Transferencias verificadas', d.transferencias_verificadas],
          ['Transferencias por verificar', d.transferencias_pendientes], ['Descuentos', d.descuentos],
          ['Salidas de caja', d.salidas], ['Diferencias al entregar', d.diferencias],
        ]} />
      </section>)}
      <p class="ayuda">El efectivo corresponde a cobros, sin sumar la base ni las transferencias. Las salidas no incluyen el pago del turno, que se consulta en su detalle. Los descuentos y las salidas se muestran por separado.</p>
    </>}
  </div>;
}

function PillLinea({ anulado, estado }: { anulado: boolean; estado: string }) {
  if (anulado) return <span class="pill pill--neutro">Anulado</span>;
  const p = pillEstadoPago(estado);
  return p && <span class={`pill ${p[0]}`}>{p[1]}</span>;
}

export function Historial({ recarga }: { recarga: number }) {
  const [vista, setVista] = useState<'turnos' | 'dias' | 'productos'>('turnos');
  const [reintento, setReintento] = useState(0);
  return <div class="historial">
    <div class="titulo-vista"><div><h1>Historial</h1><p>Turnos, resumen por día del hotel y productos vendidos</p></div>
      <button type="button" class="btn btn--secundario" onClick={() => setReintento((n) => n + 1)}>Actualizar</button>
    </div>
    <div class="segmentado" aria-label="Tipo de consulta">
      <button type="button" class="opcion" aria-pressed={vista === 'turnos'} onClick={() => setVista('turnos')}>Por turno</button>
      <button type="button" class="opcion" aria-pressed={vista === 'dias'} onClick={() => setVista('dias')}>Por día</button>
      <button type="button" class="opcion" aria-pressed={vista === 'productos'} onClick={() => setVista('productos')}>Productos</button>
    </div>
    {vista === 'turnos' && <Turnos recarga={recarga + reintento} />}
    {vista === 'dias' && <Dias recarga={recarga + reintento} />}
    {vista === 'productos' && <ProductosVendidos recarga={recarga + reintento} />}
  </div>;
}
