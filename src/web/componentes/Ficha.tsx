// Ficha de la habitación ocupada (TICKET-06, FR-06, FR-07): cuenta con cargos, pagos y saldo; «Agregar» y «Registrar pago».
// Es el panel del prototipo (abajo en el celular). Se vuelve a pedir con cada evento en vivo (`recarga`).
// Cada vista (cuenta, cargos, pago, salida, extender, desistimiento) es un componente aparte; la ficha solo decide cuál mostrar.
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { api, type Estadia, type Habitacion } from '../api.ts';
import { enviarYReleer } from '../envio.ts';
import {
  cambioEfectivo, resumenExtension, devolucionPosible, type CotizacionExtension, diaRelativo, estadoSaldo, horaBogota, hoyBogota, leerPesos, nuevaClave, pesos, resumenSeleccion, textoMedio,
  valorPago, type Producto,
} from '../logica.ts';
import { Ico } from './Ico.tsx';
import { Anular, type QueAnular } from './Anular.tsx';
import { SelectorProductos } from './SelectorProductos.tsx';
import { VistaFactura } from './SolicitudesFactura.tsx';
import { VistaCambio } from './CambioHabitacion.tsx';
import { VistaDano } from './CobrarDano.tsx';
import { AVISO_DANO_RECEPCION } from '../danos.ts';
import { textoTardio } from '../tardio.ts';
import type { Reglas } from '../ajustes.ts';
import { ayudaHoras } from '../textosConfig.ts';
import { cuantos, pillEstadoPago, textoCambio, textoDesistimiento, textoDevolucion, tituloFicha } from '../presentacion.ts';

type Sub = 'cuenta' | 'cargo' | 'pago' | 'salida' | 'extender' | 'devolucion' | 'lavanderia' | 'factura' | 'cambio' | 'dano';
type ModExt = 'NOCHE' | 'TRES_HORAS' | 'POR_HORAS';
type Medio = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA';
type MotivoDev = 'SOLO_MIRO' | 'YA_USO';
type MedioDev = 'EFECTIVO' | 'TRANSFERENCIA';

const MODALIDADES_EXT: Array<[ModExt, string]> = [['NOCHE', 'Otra noche'], ['TRES_HORAS', '3 horas'], ['POR_HORAS', 'Por horas']];
const MEDIOS: Medio[] = ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'];
const cuando = (iso: string) => `${diaRelativo(iso, hoyBogota())} ${horaBogota(iso)}`;

function Fila({ concepto, valor, total = false }: { concepto: ComponentChildren; valor: number; total?: boolean }) {
  return <div class={`fila${total ? ' fila--total' : ''}`}><div class="fila__txt"><div class="fila__concepto">{concepto}</div></div><div class="fila__valor">{pesos(valor)}</div></div>;
}

function Opciones<T extends string>({ opciones, actual, alElegir }: { opciones: Array<[T, string]>; actual: T; alElegir: (v: T) => void }) {
  return <div class="segmentado">{opciones.map(([v, t]) =>
    <button key={v} type="button" class="opcion" aria-pressed={actual === v} onClick={() => alElegir(v)}>{t}</button>)}</div>;
}

function VistaCuenta({ e, esAdmin, numero, ir, alAnular }: {
  e: Estadia; esAdmin: boolean; numero: string; ir: (s: Sub) => void; alAnular: (q: QueAnular) => void;
}) {
  const s = estadoSaldo(e.cuenta);
  const cantidad = (c: Estadia['cargos'][number]) => (c.cantidad > 1 && c.tipo !== 'ALOJAMIENTO' && c.tipo !== 'DESCUENTO' ? ` × ${c.cantidad}` : '');
  return <>
    {e.registro_tardio && <div class="nota"><Ico id="talonario" clase="ico--s" /><p>{textoTardio(e)}</p></div>}
    <section class="tarjeta"><div class="tarjeta__cab"><h3>Cargos</h3>
      <div class="acciones-cab">
        {esAdmin && <button type="button" class="enlace" onClick={() => ir('dano')}><Ico id="alerta" clase="ico--xs" />Daño</button>}
        <button type="button" class="enlace" onClick={() => ir('cargo')}><Ico id="mas" clase="ico--xs" />Agregar</button></div></div>
      {e.cargos.filter((c) => !c.anulado).map((c) => <div key={c.id} class="fila"><div class="fila__txt"><div class="fila__concepto">{c.concepto}{cantidad(c)}</div>
        <div class="fila__detalle">{cuando(c.creado_en)} · {c.creado_por}</div></div><div class="fila__valor">{pesos(c.valor)}</div></div>)}
      <Fila concepto="Total cargos" valor={e.cuenta.total_cargos} total />
    </section>
    <section class="tarjeta"><div class="tarjeta__cab"><h3>Pagos</h3>
      <button type="button" class="enlace" disabled={e.cuenta.saldo === 0} onClick={() => ir('pago')}><Ico id="mas" clase="ico--xs" />Registrar pago</button></div>
      {e.pagos.length === 0 ? <p class="ayuda">Sin pagos.</p> : e.pagos.map((p) => <MovPago key={p.id} p={p} esAdmin={esAdmin} numero={numero} alAnular={alAnular} />)}
    </section>
    <div class={`saldo saldo--${s.tono}`}><div><b>{s.titulo}</b><p>{s.detalle}</p></div><strong>{pesos(s.valor)}</strong></div>
    <div class="acciones">
      <button type="button" class="btn btn--secundario" onClick={() => ir('extender')}><Ico id="reloj" clase="ico--s" />Extender</button>
      <button type="button" class="btn btn--secundario" onClick={() => ir('lavanderia')}><Ico id="lavanderia" clase="ico--s" />Lavandería</button>
      <button type="button" class="btn btn--secundario" onClick={() => ir('cambio')}><Ico id="habitaciones" clase="ico--s" />Cambiar</button>
      <button type="button" class="btn btn--secundario" onClick={() => ir('factura')}><Ico id="facturacion" clase="ico--s" />Factura</button>
      <button type="button" class="btn btn--secundario" onClick={() => ir('devolucion')}><Ico id="devolver" clase="ico--s" />Desiste</button>
      <button type="button" class="btn btn--secundario" onClick={() => ir('salida')}><Ico id="salida" clase="ico--s" />Dar salida</button>
    </div>
  </>;
}

function MovPago({ p, esAdmin, numero, alAnular }: { p: Estadia['pagos'][number]; esAdmin: boolean; numero: string; alAnular: (q: QueAnular) => void }) {
  const pill = pillEstadoPago(p.estado, 'Llegó');
  return <div class={`mov${p.anulado ? ' mov--anulado' : ''}`}>
    <span class="mov__ico"><Ico id={p.medio === 'EFECTIVO' ? 'efectivo' : 'transferencia'} clase="ico--s" /></span>
    <div class="mov__txt"><div class="mov__titulo">{textoMedio(p.medio)}</div>
      <div class="mov__detalle">{cuando(p.registrado_en)} · {p.registrado_por}</div></div>
    <div class="mov__der"><span class="mov__valor">{pesos(p.valor)}</span>
      {pill && <span class={`pill ${pill[0]}`}>{pill[1]}</span>}
      {p.anulado && <span class="pill pill--neutro">Anulado</span>}
      {esAdmin && !p.anulado && <button type="button" class="accion-icono accion-icono--rojo" aria-label={`Anular pago de ${pesos(p.valor)}`} title="Anular"
        onClick={() => alAnular({ id: p.id, origen: 'PAGO', concepto: `Cobro · Hab. ${numero} · ${textoMedio(p.medio)}`, valor: p.valor })}><Ico id="papelera" clase="ico--s" /></button>}</div>
  </div>;
}

function VistaPago({ medio, alMedio, valor, alValor, saldo, escrito, pago }: {
  medio: Medio; alMedio: (m: Medio) => void; valor: string; alValor: (v: string) => void; saldo: number; escrito: number; pago: { valor: number };
}) {
  const cambio = cambioEfectivo(saldo, escrito);
  return <section class="tarjeta"><div class="tarjeta__cab"><h3>Medio de pago</h3></div>
    <Opciones opciones={MEDIOS.map((m) => [m, textoMedio(m)] as [Medio, string])} actual={medio} alElegir={alMedio} />
    <div class="campo"><label htmlFor="valor-pago">{medio === 'EFECTIVO' ? 'Valor recibido' : 'Valor de la transferencia'}</label>
      <input id="valor-pago" inputmode="numeric" autocomplete="off" placeholder={String(saldo)} value={valor} onInput={(ev) => alValor((ev.target as HTMLInputElement).value)} /></div>
    {medio === 'EFECTIVO'
      ? <div class={`saldo ${cambio.tipo === 'abono' ? 'saldo--aviso' : 'saldo--ok'}`}><div>
        <b>{textoCambio(cambio.tipo, 'Abono: sigue debiendo')}</b>
        <p>Entran {pesos(pago.valor)} a la caja.</p></div><strong>{pesos(cambio.valor)}</strong></div>
      : <p class="ayuda">Quedará «por verificar» hasta que la administración confirme que llegó.</p>}
    <p class="ayuda">Saldo pendiente: {pesos(saldo)}</p>
  </section>;
}

/** RN-07: nadie sale debiendo. Si queda saldo, se ofrece cobrarlo primero. TICKET-26: avisa si dejó ropa en lavandería. */
function VistaSalida({ c, lavanderia, ir }: { c: Estadia['cuenta']; lavanderia: number; ir: (s: Sub) => void }) {
  return <>
    {lavanderia > 0 && <div class="nota nota--alerta" role="alert"><Ico id="lavanderia" clase="ico--s" /><p>Tiene ropa en lavandería por entregar ({lavanderia === 1 ? '1 pedido' : `${lavanderia} pedidos`}). Entréguesela antes de que se vaya.</p></div>}
    <section class="tarjeta tarjeta--crema">
      <Fila concepto="Total cargos" valor={c.total_cargos} />
      <Fila concepto="Pagado" valor={c.pagado + c.por_verificar} />
      <Fila concepto={c.saldo ? 'Falta pagar' : 'Saldo'} valor={c.saldo} total />
    </section>
    {c.saldo > 0 && <>
      <div class="saldo saldo--alerta"><div><b>Nadie sale debiendo</b><p>Cobre el saldo antes de dar la salida. Si no paga, avise a la administradora.</p></div><strong>{pesos(c.saldo)}</strong></div>
      <button type="button" class="btn btn--primario btn--l btn--bloque" onClick={() => ir('pago')}><Ico id="efectivo" clase="ico--s" />Cobrar {pesos(c.saldo)}</button>
    </>}
    {c.por_verificar > 0 && <div class="nota"><Ico id="alerta" clase="ico--s" /><p>Hay {pesos(c.por_verificar)} en transferencias por verificar. La habitación se entrega igual; si la administración dice que no llegó, se le avisará.</p></div>}
    <div class="nota"><Ico id="lupa" clase="ico--s" /><p>La habitación pasa a «Por revisar» antes de volver a ofrecerse.</p></div>
  </>;
}

function VistaExtender({ modExt, alModExt, horas, alHoras, cotExt, reglas }: {
  modExt: ModExt; alModExt: (m: ModExt) => void; horas: number; alHoras: (h: number) => void; cotExt: CotizacionExtension | null; reglas: Pick<Reglas, 'valor_hora'> | null;
}) {
  const r = cotExt && resumenExtension(cotExt, hoyBogota());
  return <>
    <section class="tarjeta"><div class="tarjeta__cab"><h3>¿Cómo desea continuar?</h3></div>
      <Opciones opciones={MODALIDADES_EXT} actual={modExt} alElegir={alModExt} />
      {modExt === 'POR_HORAS' && <div class="campo"><span>Horas</span>
        <div class="contador">
          <button type="button" aria-label="Restar hora" disabled={horas <= 1} onClick={() => alHoras(horas - 1)}>−</button>
          <output>{cuantos(horas, 'hora', 'horas')}</output>
          <button type="button" aria-label="Sumar hora" disabled={horas >= 12} onClick={() => alHoras(horas + 1)}>+</button>
        </div>
        <span class="ayuda">{ayudaHoras(reglas)}</span></div>}
    </section>
    {r?.aviso && <div class="saldo saldo--aviso"><div><b>{r.aviso}</b><p>La noche completa reemplaza las horas.</p></div></div>}
    {cotExt && r && <section class="tarjeta tarjeta--crema" aria-live="polite">
      <Fila concepto="Valor de la extensión" valor={cotExt.valor} total />
      <p class="ayuda" style="margin-top:10px"><b>Nueva salida: {r.salida}</b></p>
    </section>}
  </>;
}

function VistaDevolucion({ d, motivo, alMotivo, medio, alMedio, esAdmin }: {
  d: ReturnType<typeof devolucionPosible>; motivo: MotivoDev; alMotivo: (m: MotivoDev) => void; medio: MedioDev; alMedio: (m: MedioDev) => void; esAdmin: boolean;
}) {
  return <>
    <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>Si solo miró la habitación, se devuelve todo. Si ya la usó (se instaló o se acostó), no se devuelve nada. Si pagó por transferencia sin confirmar, espere a la administración.</p></div>
    <section class="tarjeta"><div class="tarjeta__cab"><h3>Motivo</h3></div>
      <Opciones opciones={[['SOLO_MIRO', 'Solo la miró'], ['YA_USO', 'Ya la usó']]} actual={motivo} alElegir={alMotivo} />
      {esAdmin && d.valor > 0 && <div class="campo"><span>¿Cómo se devuelve?</span>
        <Opciones opciones={[['EFECTIVO', 'En efectivo (sale de la caja)'], ['TRANSFERENCIA', 'Por transferencia']]} actual={medio} alElegir={alMedio} /></div>}
    </section>
    {d.bloqueo
      ? <div class="saldo saldo--aviso"><div><b>Todavía no se puede devolver</b><p>{d.bloqueo}</p></div></div>
      : <div class={`saldo ${d.valor ? 'saldo--alerta' : 'saldo--ok'}`}><div>
        <b>{d.valor ? 'Se le devuelve' : 'No se devuelve nada'}</b>
        <p>{textoDevolucion(d.valor, medio)}</p>
      </div><strong>{pesos(d.valor)}</strong></div>}
    <p class="ayuda">La devolución queda unida a esta estadía para que no se cuente como ingreso ni se devuelva dos veces.</p>
  </>;
}

function BotonPie({ peligro = false, deshabilitado, alTocar, icono, children }: {
  peligro?: boolean; deshabilitado: boolean; alTocar: () => void; icono: string; children: ComponentChildren;
}) {
  return <button type="button" class={`btn ${peligro ? 'btn--peligro' : 'btn--primario'} btn--l btn--bloque`} disabled={deshabilitado} onClick={alTocar}>
    <Ico id={icono} clase="ico--s" />{children}</button>;
}

export function Ficha({ habitacion, recarga, reglas, esAdmin = false, alCerrar, alCambiar, alSalir }: {
  habitacion: Habitacion; recarga: number; reglas: Pick<Reglas, 'valor_hora'> | null; esAdmin?: boolean; alCerrar: () => void; alCambiar: () => void; alSalir: (texto: string) => void;
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
  const [motivoDev, setMotivoDev] = useState<MotivoDev>('SOLO_MIRO');
  const [medioDev, setMedioDev] = useState<MedioDev>('EFECTIVO');

  useEffect(() => { api.estadia(id).then(setEst).catch((e: Error) => setError(e.message)); }, [id, recarga]);
  useEffect(() => { if ((sub === 'cargo' || sub === 'lavanderia') && catalogo.length === 0) api.productos().then((r) => setCatalogo(r.items)).catch((e: Error) => setError(e.message)); }, [sub]);
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
    if (s === 'cargo' || s === 'lavanderia') setCantidades({});
    if (s === 'pago') { setMedio('EFECTIVO'); setValor(''); }
    if (s === 'extender') { setModExt('POR_HORAS'); setHoras(1); }
    if (s === 'devolucion') { setMotivoDev('SOLO_MIRO'); setMedioDev('EFECTIVO'); }
  }

  /**
   * Envía una operación; `alTerminar` decide qué sigue (por defecto, recargar la cuenta y volver a ella). Si la operación
   * quedó pero la cuenta no se pudo releer, vuelve a la cuenta con el aviso de no repetirla (HAL-09).
   */
  async function enviar(accion: () => Promise<unknown>, alTerminar?: (r: unknown) => void, alFallar?: () => Promise<void>) {
    setEnviando(true);
    setError('');
    try {
      const r = await enviarYReleer(accion, async () => {
        if (alTerminar) return;
        alCambiar();
        setEst(await api.estadia(id));
      });
      if (!r.hecho) {
        setError(r.error);
        await alFallar?.();
      } else if (alTerminar) {
        alTerminar(r.resultado);
      } else {
        ir('cuenta');
        setError(r.aviso);
      }
    } finally {
      setEnviando(false);
    }
  }

  const sumar = (pid: string, paso: number) => setCantidades({ ...cantidades, [pid]: Math.max(0, Math.min(20, (cantidades[pid] ?? 0) + paso)) });
  const e = est;
  const subtitulo = e ? `${e.huesped.nombre_mostrado} · ${cuantos(e.personas, 'persona', 'personas')} · sale ${cuando(e.salida_prevista_en)}` : '';
  // Las prendas van como pedido de lavandería (TICKET-23); el resto, como cargo.
  const prendas = catalogo.filter((p) => p.grupo === 'LAVANDERIA');
  const otros = catalogo.filter((p) => p.grupo !== 'LAVANDERIA');
  const sel = resumenSeleccion(sub === 'lavanderia' ? prendas : otros, cantidades);
  const saldo = e?.cuenta.saldo ?? 0;
  const escrito = leerPesos(valor) ?? saldo;
  const pago = valorPago(medio, saldo, escrito);
  const devolucion = e ? devolucionPosible(e.pagos, motivoDev, esAdmin) : null;

  function vista(): { cuerpo: ComponentChildren; pie: ComponentChildren } {
    if (sub === 'lavanderia') {
      const texto = sel.items.length ? `Recibir ropa · ${pesos(sel.total)}` : 'Elija las prendas';
      return { cuerpo: <>
        <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>El lavado se carga a la cuenta de la habitación. Cuando el huésped recoja la ropa en recepción, se cobra al entregarla.</p></div>
        <SelectorProductos catalogo={prendas} cantidades={cantidades} sel={sel} sumar={sumar} />
      </>,
        pie: <BotonPie icono="mas" deshabilitado={!sel.items.length || enviando}
          alTocar={() => enviar(() => api.pedirLavanderia(id, sel.items.map((x) => ({ producto_id: x.producto.id, cantidad: x.cantidad })), clave))}>{texto}</BotonPie> };
    }
    if (sub === 'cargo') {
      const texto = sel.items.length ? `Agregar ${cuantos(sel.items.length, 'producto', 'productos')} · ${pesos(sel.total)}` : 'Elija productos';
      return { cuerpo: <>
        {!esAdmin && <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>{AVISO_DANO_RECEPCION}</p></div>}
        <SelectorProductos catalogo={otros} cantidades={cantidades} sel={sel} sumar={sumar} />
      </>,
        pie: <BotonPie icono="mas" deshabilitado={!sel.items.length || enviando}
          alTocar={() => enviar(() => api.agregarCargos(id, sel.items.map((x) => ({ producto_id: x.producto.id, cantidad: x.cantidad })), clave))}>{texto}</BotonPie> };
    }
    if (sub === 'factura') return { cuerpo: <VistaFactura estadiaId={id} />, pie: null };
    if (sub === 'dano') return { cuerpo: <VistaDano estadiaId={id} alListo={async () => { alCambiar(); setEst(await api.estadia(id)); ir('cuenta'); }} />, pie: null };
    if (sub === 'cambio') return { cuerpo: <VistaCambio estadiaId={id} actual={habitacion.numero} alCambiar={(texto) => { alCambiar(); alSalir(texto); }} />, pie: null };
    if (!e) return { cuerpo: null, pie: null };
    switch (sub) {
      case 'pago':
        return { cuerpo: <VistaPago medio={medio} alMedio={setMedio} valor={valor} alValor={setValor} saldo={saldo} escrito={escrito} pago={pago} />,
          pie: <BotonPie icono="check" deshabilitado={enviando || pago.valor < 1} alTocar={() => enviar(() => api.registrarPago(id, medio, pago.valor, clave))}>
            Registrar pago de {pesos(pago.valor)}</BotonPie> };
      case 'salida':
        return { cuerpo: <VistaSalida c={e.cuenta} lavanderia={e.lavanderia_por_entregar} ir={ir} />,
          pie: <BotonPie icono="salida" deshabilitado={e.cuenta.saldo > 0 || enviando}
            alTocar={() => enviar(() => api.darSalida(id), () => alSalir(`Salida registrada. La habitación ${habitacion.numero} queda por revisar.`),
              async () => setEst(await api.estadia(id).catch(() => e)))}>{e.cuenta.saldo > 0 ? 'Primero cobre el saldo' : 'Dar salida'}</BotonPie> };
      case 'extender':
        return { cuerpo: <VistaExtender modExt={modExt} alModExt={setModExt} horas={horas} alHoras={setHoras} cotExt={cotExt} reglas={reglas} />,
          pie: <BotonPie icono="reloj" deshabilitado={!cotExt || enviando}
            alTocar={() => enviar(() => api.extender(id, modExt === 'POR_HORAS' ? { modalidad: modExt, horas } : { modalidad: modExt }, clave))}>
            {cotExt ? `Extender · ${pesos(cotExt.valor)}` : 'Calculando…'}</BotonPie> };
      case 'devolucion': {
        const d = devolucion!;
        return { cuerpo: <VistaDevolucion d={d} motivo={motivoDev} alMotivo={setMotivoDev} medio={medioDev} alMedio={setMedioDev} esAdmin={esAdmin} />,
          pie: <BotonPie peligro icono="devolver" deshabilitado={!!d.bloqueo || enviando}
            alTocar={() => enviar(() => api.desistir(id, { motivo: motivoDev, medio: medioDev }, clave),
              (r) => alSalir(textoDesistimiento(habitacion.numero, r as { valor: number; medio: string | null })))}>
            {d.valor && !d.bloqueo ? `Registrar devolución de ${pesos(d.valor)}` : 'Registrar desistimiento'}</BotonPie> };
      }
      default:
        return { cuerpo: <VistaCuenta e={e} esAdmin={esAdmin} numero={habitacion.numero} ir={ir} alAnular={setAnulando} />, pie: null };
    }
  }

  const { cuerpo, pie } = vista();
  const enCuenta = sub === 'cuenta';
  return (
    <div class="capa-panel">
      <button type="button" class="velo velo--visible" aria-label="Cerrar" tabIndex={-1} onClick={alCerrar} />
      <dialog open class="panel" aria-modal="true" aria-labelledby="panel-titulo">
        <div class="panel__cab">
          <button type="button" class="redondo" aria-label={enCuenta ? 'Cerrar' : 'Volver'} onClick={() => (enCuenta ? alCerrar() : ir('cuenta'))}>
            <Ico id={enCuenta ? 'cerrar' : 'atras'} clase="ico--s" /></button>
          <div class="titulos"><h2 id="panel-titulo">{tituloFicha(sub, habitacion.numero)}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
        </div>
        <div class="panel__cuerpo">
          {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
          {cuerpo}
        </div>
        {pie && <div class="panel__pie">{pie}</div>}
      </dialog>
      {anulando && <Anular que={anulando} alCerrar={() => setAnulando(null)} alAnular={async () => { setAnulando(null); alCambiar(); setEst(await api.estadia(id)); }} />}
    </div>
  );
}
