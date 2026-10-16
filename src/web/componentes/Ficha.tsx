// Ficha de la habitación ocupada (TICKET-06, FR-06, FR-07): cuenta con cargos, pagos y saldo; «Agregar» y «Registrar pago».
// Es el panel del prototipo (abajo en el celular). Se vuelve a pedir con cada evento en vivo (`recarga`).
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type Estadia, type Habitacion } from '../api.ts';
import {
  agruparCatalogo, cambioEfectivo, resumenExtension, devolucionPosible, type CotizacionExtension, diaRelativo, estadoSaldo, horaBogota, hoyBogota, leerPesos, nuevaClave, pesos, resumenSeleccion, textoMedio,
  valorPago, type Producto,
} from '../logica.ts';
import { Ico } from './Ico.tsx';
import { Anular, type QueAnular } from './Anular.tsx';

type Sub = 'cuenta' | 'cargo' | 'pago' | 'salida' | 'extender' | 'devolucion';
type ModExt = 'NOCHE' | 'TRES_HORAS' | 'POR_HORAS';
type Medio = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA';

export function Ficha({ habitacion, recarga, esAdmin = false, alCerrar, alCambiar, alSalir }: {
  habitacion: Habitacion; recarga: number; esAdmin?: boolean; alCerrar: () => void; alCambiar: () => void; alSalir: (texto: string) => void;
}) {
  const id = habitacion.estadia_activa!.id;
  const [est, setEst] = useState<Estadia | null>(null);
  const [sub, setSub] = useState<Sub>('cuenta');
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [medio, setMedio] = useState<Medio>('EFECTIVO');
  const [valor, setValor] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Una clave por operación: si se toca dos veces o se reintenta, no se duplica.
  const [clave, setClave] = useState(nuevaClave);
  const [modExt, setModExt] = useState<ModExt>('POR_HORAS');
  const [horas, setHoras] = useState(1);
  const [cotExt, setCotExt] = useState<CotizacionExtension | null>(null);
  const [anulando, setAnulando] = useState<QueAnular | null>(null);
  const [motivoDev, setMotivoDev] = useState<'SOLO_MIRO' | 'YA_USO'>('SOLO_MIRO');
  const [medioDev, setMedioDev] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO');

  useEffect(() => { api.estadia(id).then(setEst).catch((e: Error) => setError(e.message)); }, [id, recarga]);
  useEffect(() => { if (sub === 'cargo' && catalogo.length === 0) api.productos().then((r) => setCatalogo(r.items)).catch((e: Error) => setError(e.message)); }, [sub]);
  // Cotización de la extensión con la misma regla del servidor (RN-04): valor, nueva salida y aviso de las 4:00 p. m.
  useEffect(() => {
    if (sub !== 'extender') return;
    let vigente = true;
    setCotExt(null);
    api.cotizarExtension(id, modExt === 'POR_HORAS' ? { modalidad: modExt, horas } : { modalidad: modExt })
      .then((c) => { if (vigente) { setCotExt(c); setError(''); } })
      .catch((e: Error) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [sub, modExt, horas]);
  useEffect(() => {
    const cerrarConEscape = (ev: KeyboardEvent) => { if (ev.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', cerrarConEscape);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', cerrarConEscape); document.body.style.overflow = ''; };
  }, []);

  function ir(s: Sub) {
    setSub(s);
    setError('');
    setClave(nuevaClave());
    if (s === 'cargo') setCantidades({});
    if (s === 'pago') { setMedio('EFECTIVO'); setValor(''); }
    if (s === 'extender') { setModExt('POR_HORAS'); setHoras(1); }
    if (s === 'devolucion') { setMotivoDev('SOLO_MIRO'); setMedioDev('EFECTIVO'); }
  }

  async function enviar(accion: () => Promise<unknown>) {
    setEnviando(true);
    setError('');
    try {
      await accion();
      alCambiar();
      setEst(await api.estadia(id));
      ir('cuenta');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo: no se duplicará.');
    } finally {
      setEnviando(false);
    }
  }

  const sumar = (pid: string, paso: number) => setCantidades({ ...cantidades, [pid]: Math.max(0, Math.min(20, (cantidades[pid] ?? 0) + paso)) });
  const e = est;
  const subtitulo = e ? `${e.huesped.nombre_mostrado} · ${e.personas} ${e.personas === 1 ? 'persona' : 'personas'} · sale ${diaRelativo(e.salida_prevista_en, hoyBogota())} ${horaBogota(e.salida_prevista_en)}` : '';
  const sel = resumenSeleccion(catalogo, cantidades);
  const saldo = e?.cuenta.saldo ?? 0;
  const escrito = leerPesos(valor) ?? saldo;
  const pago = valorPago(medio, saldo, escrito);

  let cuerpo = null;
  let pie = null;
  if (e && sub === 'cuenta') {
    const s = estadoSaldo(e.cuenta);
    cuerpo = <>
      <section class="tarjeta"><div class="tarjeta__cab"><h3>Cargos</h3>
        <button type="button" class="enlace" onClick={() => ir('cargo')}><Ico id="mas" clase="ico--xs" />Agregar</button></div>
        {e.cargos.filter((c) => !c.anulado).map((c) => <div class="fila"><div class="fila__txt"><div class="fila__concepto">{c.concepto}{c.cantidad > 1 && c.tipo !== 'ALOJAMIENTO' && c.tipo !== 'DESCUENTO' ? ` × ${c.cantidad}` : ''}</div>
          <div class="fila__detalle">{diaRelativo(c.creado_en, hoyBogota())} {horaBogota(c.creado_en)} · {c.creado_por}</div></div><div class="fila__valor">{pesos(c.valor)}</div></div>)}
        <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Total cargos</div></div><div class="fila__valor">{pesos(e.cuenta.total_cargos)}</div></div>
      </section>
      <section class="tarjeta"><div class="tarjeta__cab"><h3>Pagos</h3>
        <button type="button" class="enlace" disabled={saldo === 0} onClick={() => ir('pago')}><Ico id="mas" clase="ico--xs" />Registrar pago</button></div>
        {e.pagos.length === 0 ? <p class="ayuda">Sin pagos.</p> : e.pagos.map((p) => <div class={`mov${p.anulado ? ' mov--anulado' : ''}`}>
          <span class="mov__ico"><Ico id={p.medio === 'EFECTIVO' ? 'efectivo' : 'transferencia'} clase="ico--s" /></span>
          <div class="mov__txt"><div class="mov__titulo">{textoMedio(p.medio)}</div>
            <div class="mov__detalle">{diaRelativo(p.registrado_en, hoyBogota())} {horaBogota(p.registrado_en)} · {p.registrado_por}</div></div>
          <div class="mov__der"><span class="mov__valor">{pesos(p.valor)}</span>
            {p.estado === 'POR_VERIFICAR' && <span class="pill pill--aviso">Por verificar</span>}
            {p.estado === 'RECHAZADO' && <span class="pill pill--alerta">No llegó</span>}
            {p.estado === 'VERIFICADO' && <span class="pill pill--exito">Llegó</span>}
            {p.anulado && <span class="pill pill--neutro">Anulado</span>}
            {esAdmin && !p.anulado && <button type="button" class="accion-icono accion-icono--rojo" aria-label={`Anular pago de ${pesos(p.valor)}`} title="Anular"
              onClick={() => setAnulando({ id: p.id, origen: 'PAGO', concepto: `Cobro · Hab. ${habitacion.numero} · ${textoMedio(p.medio)}`, valor: p.valor })}><Ico id="papelera" clase="ico--s" /></button>}</div>
        </div>)}
      </section>
      <div class={`saldo saldo--${s.tono}`}><div><b>{s.titulo}</b><p>{s.detalle}</p></div><strong>{pesos(s.valor)}</strong></div>
      <div class="acciones">
        <button type="button" class="btn btn--secundario" onClick={() => ir('extender')}><Ico id="reloj" clase="ico--s" />Extender</button>
        <button type="button" class="btn btn--secundario" onClick={() => ir('devolucion')}><Ico id="devolver" clase="ico--s" />Desiste</button>
        <button type="button" class="btn btn--secundario" onClick={() => ir('salida')}><Ico id="salida" clase="ico--s" />Dar salida</button>
      </div>
    </>;
  } else if (sub === 'cargo') {
    cuerpo = <>
      {agruparCatalogo(catalogo).map(([grupo, productos]) => <>
        <p class="subtitulo">{grupo}</p>
        <div class="catalogo">{productos.map((p) => {
          const n = cantidades[p.id] ?? 0;
          return <button type="button" class="producto" aria-pressed={n > 0} aria-label={`Agregar ${p.nombre}${n ? ', van ' + n : ''}`} onClick={() => sumar(p.id, 1)}>
            <strong>{p.nombre}</strong><span>{pesos(p.precio)}</span>{n > 0 && <em class="producto__n">{n}</em>}</button>;
        })}</div>
      </>)}
      {sel.items.length === 0
        ? <p class="ayuda">Toque los productos para agregarlos. Puede elegir varios y tocar de nuevo para sumar cantidad.</p>
        : <section class="tarjeta tarjeta--oro"><div class="tarjeta__cab"><h3>Seleccionados</h3></div>
          {sel.items.map((x) => <div class="item-sel"><span class="item-sel__nombre">{x.producto.nombre}</span>
            <div class="contador contador--mini">
              <button type="button" aria-label={`Quitar uno de ${x.producto.nombre}`} onClick={() => sumar(x.producto.id, -1)}>−</button>
              <output>{x.cantidad}</output>
              <button type="button" aria-label={`Agregar uno de ${x.producto.nombre}`} onClick={() => sumar(x.producto.id, 1)}>+</button>
            </div><strong>{pesos(x.subtotal)}</strong></div>)}
          <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Total</div></div><div class="fila__valor">{pesos(sel.total)}</div></div>
        </section>}
    </>;
    pie = <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={!sel.items.length || enviando}
      onClick={() => enviar(() => api.agregarCargos(id, sel.items.map((x) => ({ producto_id: x.producto.id, cantidad: x.cantidad })), clave))}>
      <Ico id="mas" clase="ico--s" />{sel.items.length ? `Agregar ${sel.items.length} ${sel.items.length === 1 ? 'producto' : 'productos'} · ${pesos(sel.total)}` : 'Elija productos'}</button>;
  } else if (e && sub === 'pago') {
    const cambio = cambioEfectivo(saldo, escrito);
    cuerpo = <section class="tarjeta"><div class="tarjeta__cab"><h3>Medio de pago</h3></div>
      <div class="segmentado">{(['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'] as Medio[]).map((m) =>
        <button type="button" class="opcion" aria-pressed={medio === m} onClick={() => setMedio(m)}>{textoMedio(m)}</button>)}</div>
      <div class="campo"><label for="valor-pago">{medio === 'EFECTIVO' ? 'Valor recibido' : 'Valor de la transferencia'}</label>
        <input id="valor-pago" inputmode="numeric" autocomplete="off" placeholder={String(saldo)} value={valor} onInput={(ev) => setValor((ev.target as HTMLInputElement).value)} /></div>
      {medio === 'EFECTIVO'
        ? <div class={`saldo ${cambio.tipo === 'abono' ? 'saldo--aviso' : 'saldo--ok'}`}><div>
          <b>{cambio.tipo === 'vueltas' ? 'Vueltas' : cambio.tipo === 'abono' ? 'Abono: sigue debiendo' : 'Pago exacto'}</b>
          <p>Entran {pesos(pago.valor)} a la caja.</p></div><strong>{pesos(cambio.valor)}</strong></div>
        : <p class="ayuda">Quedará «por verificar» hasta que la administración confirme que llegó.</p>}
      <p class="ayuda">Saldo pendiente: {pesos(saldo)}</p>
    </section>;
    pie = <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando || pago.valor < 1}
      onClick={() => enviar(() => api.registrarPago(id, medio, pago.valor, clave))}><Ico id="check" clase="ico--s" />Registrar pago de {pesos(pago.valor)}</button>;
  }

  if (e && sub === 'salida') {
    // RN-07: nadie sale debiendo. Si queda saldo, se ofrece cobrarlo primero.
    const c = e.cuenta;
    cuerpo = <>
      <section class="tarjeta tarjeta--crema">
        <div class="fila"><div class="fila__txt"><div class="fila__concepto">Total cargos</div></div><div class="fila__valor">{pesos(c.total_cargos)}</div></div>
        <div class="fila"><div class="fila__txt"><div class="fila__concepto">Pagado</div></div><div class="fila__valor">{pesos(c.pagado + c.por_verificar)}</div></div>
        <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">{c.saldo ? 'Falta pagar' : 'Saldo'}</div></div><div class="fila__valor">{pesos(c.saldo)}</div></div>
      </section>
      {c.saldo > 0 && <>
        <div class="saldo saldo--alerta"><div><b>Nadie sale debiendo</b><p>Cobre el saldo antes de dar la salida. Si no paga, avise a la administradora.</p></div><strong>{pesos(c.saldo)}</strong></div>
        <button type="button" class="btn btn--primario btn--l btn--bloque" onClick={() => ir('pago')}><Ico id="efectivo" clase="ico--s" />Cobrar {pesos(c.saldo)}</button>
      </>}
      {c.por_verificar > 0 && <div class="nota"><Ico id="alerta" clase="ico--s" /><p>Hay {pesos(c.por_verificar)} en transferencias por verificar. La habitación se entrega igual; si la administración dice que no llegó, se le avisará.</p></div>}
      <div class="nota"><Ico id="lupa" clase="ico--s" /><p>La habitación pasa a «Por revisar» antes de volver a ofrecerse.</p></div>
    </>;
    pie = <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={c.saldo > 0 || enviando} onClick={async () => {
      setEnviando(true);
      setError('');
      try {
        await api.darSalida(id);
        alSalir(`Salida registrada. La habitación ${habitacion.numero} queda por revisar.`);
      } catch (err) {
        setError(err instanceof ErrorApi ? err.message : 'No se pudo conectar con el sistema. Intente de nuevo.');
        setEst(await api.estadia(id).catch(() => e));
      } finally {
        setEnviando(false);
      }
    }}><Ico id="salida" clase="ico--s" />{c.saldo > 0 ? 'Primero cobre el saldo' : 'Dar salida'}</button>;
  }

  if (e && sub === 'extender') {
    const r = cotExt && resumenExtension(cotExt, hoyBogota());
    cuerpo = <>
      <section class="tarjeta"><div class="tarjeta__cab"><h3>¿Cómo desea continuar?</h3></div>
        <div class="segmentado">{([['NOCHE', 'Otra noche'], ['TRES_HORAS', '3 horas'], ['POR_HORAS', 'Por horas']] as Array<[ModExt, string]>).map(([m, t]) =>
          <button type="button" class="opcion" aria-pressed={modExt === m} onClick={() => setModExt(m)}>{t}</button>)}</div>
        {modExt === 'POR_HORAS' && <div class="campo"><span>Horas</span>
          <div class="contador">
            <button type="button" aria-label="Restar hora" disabled={horas <= 1} onClick={() => setHoras(horas - 1)}>−</button>
            <output>{horas} {horas === 1 ? 'hora' : 'horas'}</output>
            <button type="button" aria-label="Sumar hora" disabled={horas >= 12} onClick={() => setHoras(horas + 1)}>+</button>
          </div>
          <span class="ayuda">$8.000 por hora empezada, solo para extender. Sin descuento.</span></div>}
      </section>
      {r?.aviso && <div class="saldo saldo--aviso"><div><b>{r.aviso}</b><p>La noche completa reemplaza las horas.</p></div></div>}
      {cotExt && <section class="tarjeta tarjeta--crema" aria-live="polite">
        <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Valor de la extensión</div></div><div class="fila__valor">{pesos(cotExt.valor)}</div></div>
        <p class="ayuda" style="margin-top:10px"><b>Nueva salida: {r!.salida}</b></p>
      </section>}
    </>;
    pie = <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={!cotExt || enviando}
      onClick={() => enviar(() => api.extender(id, modExt === 'POR_HORAS' ? { modalidad: modExt, horas } : { modalidad: modExt }, clave))}>
      <Ico id="reloj" clase="ico--s" />{cotExt ? `Extender · ${pesos(cotExt.valor)}` : 'Calculando…'}</button>;
  }

  if (e && sub === 'devolucion') {
    const d = devolucionPosible(e.pagos, motivoDev, esAdmin);
    cuerpo = <>
      <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>Si solo miró la habitación, se devuelve todo. Si ya la usó (se instaló o se acostó), no se devuelve nada. Si pagó por transferencia sin confirmar, espere a la administración.</p></div>
      <section class="tarjeta"><div class="tarjeta__cab"><h3>Motivo</h3></div>
        <div class="segmentado">
          <button type="button" class="opcion" aria-pressed={motivoDev === 'SOLO_MIRO'} onClick={() => setMotivoDev('SOLO_MIRO')}>Solo la miró</button>
          <button type="button" class="opcion" aria-pressed={motivoDev === 'YA_USO'} onClick={() => setMotivoDev('YA_USO')}>Ya la usó</button>
        </div>
        {esAdmin && d.valor > 0 && <div class="campo"><span>¿Cómo se devuelve?</span>
          <div class="segmentado">
            <button type="button" class="opcion" aria-pressed={medioDev === 'EFECTIVO'} onClick={() => setMedioDev('EFECTIVO')}>En efectivo (sale de la caja)</button>
            <button type="button" class="opcion" aria-pressed={medioDev === 'TRANSFERENCIA'} onClick={() => setMedioDev('TRANSFERENCIA')}>Por transferencia</button>
          </div></div>}
      </section>
      {d.bloqueo
        ? <div class="saldo saldo--aviso"><div><b>Todavía no se puede devolver</b><p>{d.bloqueo}</p></div></div>
        : <div class={`saldo ${d.valor ? 'saldo--alerta' : 'saldo--ok'}`}><div>
          <b>{d.valor ? 'Se le devuelve' : 'No se devuelve nada'}</b>
          <p>{d.valor ? (medioDev === 'EFECTIVO' ? 'Sale de la caja del turno; no cuenta como venta.' : 'La administración hace la transferencia.') : 'La estadía se cierra y la habitación pasa a revisión.'}</p>
        </div><strong>{pesos(d.valor)}</strong></div>}
      <p class="ayuda">La devolución queda unida a esta estadía para que no se cuente como ingreso ni se devuelva dos veces.</p>
    </>;
    pie = <button type="button" class="btn btn--peligro btn--l btn--bloque" disabled={!!d.bloqueo || enviando} onClick={async () => {
      setEnviando(true);
      setError('');
      try {
        const r = await api.desistir(id, { motivo: motivoDev, medio: medioDev }, clave);
        alSalir(r.valor
          ? `Desistimiento registrado en la ${habitacion.numero}: se devolvieron ${pesos(r.valor)}${r.medio === 'EFECTIVO' ? ' de la caja' : ' por transferencia'}. La habitación queda por revisar.`
          : `Desistimiento registrado en la ${habitacion.numero}, sin devolución. La habitación queda por revisar.`);
      } catch (err) {
        setError(err instanceof ErrorApi ? err.message : 'No se pudo conectar con el sistema. Intente de nuevo: no se duplicará.');
      } finally {
        setEnviando(false);
      }
    }}><Ico id="devolver" clase="ico--s" />{d.valor && !d.bloqueo ? `Registrar devolución de ${pesos(d.valor)}` : 'Registrar desistimiento'}</button>;
  }

  const titulo = sub === 'devolucion' ? 'Devolución por desistimiento' : sub === 'extender' ? 'Extender estadía' : sub === 'cargo' ? 'Agregar cargos' : sub === 'pago' ? 'Registrar pago' : sub === 'salida' ? 'Dar salida' : `Hab. ${habitacion.numero}`;
  return (
    <div class="capa-panel">
      <div class="velo velo--visible" onClick={alCerrar} />
      <section class="panel" role="dialog" aria-modal="true" aria-labelledby="panel-titulo">
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label={sub === 'cuenta' ? 'Cerrar' : 'Volver'} onClick={() => (sub === 'cuenta' ? alCerrar() : ir('cuenta'))}>
            <Ico id={sub === 'cuenta' ? 'cerrar' : 'atras'} clase="ico--s" /></button>
          <div class="titulos"><h2 id="panel-titulo">{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
        </div>
        <div class="panel__cuerpo">
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
          {cuerpo}
        </div>
        {pie && <div class="panel__pie">{pie}</div>}
      </section>
      {anulando && <Anular que={anulando} alCerrar={() => setAnulando(null)} alAnular={async () => { setAnulando(null); alCambiar(); setEst(await api.estadia(id)); }} />}
    </div>
  );
}
