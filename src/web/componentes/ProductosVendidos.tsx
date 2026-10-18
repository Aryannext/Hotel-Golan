// Productos vendidos (TICKET-35; FR-32): qué se vendió por turno, por día del hotel, por semana o por mes, sin contar
// productos en cada turno (administradora, HG-ACT-001 V5-20). Lo calcula la API con lo cargado y lo vendido de contado.
import { useEffect, useState } from 'preact/hooks';
import { api, type InformeProductos } from '../api.ts';
import { pesos } from '../logica.ts';
import { diaHotelActual, fechaReporte, rangoPeriodo, textoGrupo, type Periodo } from '../reportes.ts';

/** Tabla por grupo y producto, con cantidades y valores. */
export function ListaProductos({ informe }: { informe: InformeProductos }) {
  if (informe.grupos.length === 0) return <p class="vacio">No se vendieron productos en este periodo.</p>;
  return <>
    {informe.grupos.map((g) => <section class="tarjeta" key={g.grupo}>
      <div class="tarjeta__cab"><h3>{textoGrupo(g.grupo)}</h3><span class="ayuda">{g.cantidad} · {pesos(g.valor)}</span></div>
      {g.productos.map((p) => <div class="fila" key={p.nombre}><div class="fila__txt"><div class="fila__concepto">{p.nombre} × {p.cantidad}</div></div>
        <div class="fila__valor">{pesos(p.valor)}</div></div>)}
    </section>)}
    <div class="saldo saldo--ok"><div><b>Total</b><p>{informe.cantidad} productos</p></div><strong>{pesos(informe.valor)}</strong></div>
  </>;
}

/** Productos vendidos en un turno (detalle del Historial). */
export function ProductosDelTurno({ turnoId, recarga }: { turnoId: string; recarga: number }) {
  const [informe, setInforme] = useState<InformeProductos | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.productosVendidos({ turno_id: turnoId }).then(setInforme).catch((e: Error) => setError(e.message)); }, [turnoId, recarga]);
  return <section class="tarjeta"><h2>Productos vendidos en el turno</h2>
    {error && <p class="nota nota--alerta" role="alert">{error}</p>}
    {informe ? <ListaProductos informe={informe} /> : !error && <p><output>Consultando…</output></p>}
  </section>;
}

const PERIODOS: Array<[Periodo, string]> = [['DIA', 'Día'], ['SEMANA', 'Semana'], ['MES', 'Mes']];

/** Vista «Productos» del Historial: elegir día, semana o mes. */
export function ProductosVendidos({ recarga }: { recarga: number }) {
  const [periodo, setPeriodo] = useState<Periodo>('DIA');
  const [fecha, setFecha] = useState(diaHotelActual);
  const [informe, setInforme] = useState<InformeProductos | null>(null);
  const [error, setError] = useState('');
  const rango = rangoPeriodo(periodo, fecha);
  useEffect(() => {
    let vigente = true;
    setInforme(null); setError('');
    api.productosVendidos(rango).then((r) => { if (vigente) setInforme(r); }).catch((e: Error) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [periodo, fecha, recarga]);
  return <div class="historial">
    <div class="tarjeta productos__filtro">
      <div class="segmentado" aria-label="Periodo">{PERIODOS.map(([p, t]) =>
        <button key={p} type="button" class="opcion" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>{t}</button>)}</div>
      <label class="campo"><span>{periodo === 'DIA' ? 'Día' : 'Cualquier día del periodo'}</span>
        <input type="date" required value={fecha} onInput={(ev) => ev.currentTarget.value && setFecha(ev.currentTarget.value)} /></label>
    </div>
    <p class="ayuda">Del {fechaReporte(rango.desde)} al {fechaReporte(rango.hasta)}. Cada día va de 6:30 a. m. a 6:30 a. m. Cuenta lo cargado a las habitaciones, lo vendido de contado y la lavandería; no cuenta lo anulado.</p>
    {error && <p class="nota nota--alerta" role="alert">{error}</p>}
    {informe ? <ListaProductos informe={informe} /> : !error && <p><output>Consultando…</output></p>}
  </div>;
}
