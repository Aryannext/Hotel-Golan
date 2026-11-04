// Ficha grande de la habitación y su cuenta (Imagen 2).
// Encabezado con miniatura y estadía, tablas de cargos y pagos, widget de cargos rápidos y acciones de estadía.
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { api, ErrorApi, type Estadia, type Habitacion } from '../api.ts';
import {
  cambioEfectivo, resumenExtension, devolucionPosible, type CotizacionExtension, diaRelativo, horaBogota, hoyBogota, leerPesos, nuevaClave, pesos, resumenSeleccion, textoMedio,
  valorPago, type Producto,
} from '../logica.ts';
import { fechaLarga } from '../habitacion.ts';
import { Ico } from './Ico.tsx';
import { Panel } from './Panel.tsx';
import { FotoHabitacion } from './FotoHabitacion.tsx';
import { BancosAdicionales } from './BancosAdicionales.tsx';
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
type PestanaFicha = 'cuenta' | 'huesped' | 'historial' | 'notas' | 'llave' | 'limpieza';

const MODALIDADES_EXT: Array<[ModExt, string]> = [['NOCHE', 'Otra noche'], ['TRES_HORAS', '3 horas'], ['POR_HORAS', 'Por horas']];
const MEDIOS: Medio[] = ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'];
const SIN_CONEXION = 'No se pudo conectar con el sistema. Intente de nuevo: no se duplicará.';
// Originales recuperados: respaldo estático sin depender del almacenamiento del navegador.
const FOTOS_PRODUCTOS: Record<string, string> = {
  'llave perdida': '/productos/llave.jpg',
  'recargo aseo extremo': '/productos/limpieza.jpg',
  'coca-cola': '/productos/coca-cola.jpg',
  'gatorade': '/productos/gatorade.jpg',
  'hit': '/productos/hit.jpg',
};
const cuando = (iso: string) => `${diaRelativo(iso, hoyBogota())} ${horaBogota(iso)}`;

/** Asigna categoría e icono semántico a cada cargo según su descripción y tipo. */
function categorizarCargo(c: Estadia['cargos'][number]): { categoria: string; icono: string; color: string } {
  if (c.tipo === 'ALOJAMIENTO') return { categoria: 'Alojamiento', icono: 'habitaciones', color: 'rojo' };
  const conc = c.concepto.toLowerCase();
  if (conc.includes('desayuno') || conc.includes('alimento') || conc.includes('comida') || conc.includes('cafe')) {
    return { categoria: 'Alimentos', icono: 'cafe', color: 'naranja' };
  }
  if (conc.includes('gaseosa') || conc.includes('bebida') || conc.includes('agua') || conc.includes('jugo')) {
    return { categoria: 'Bebidas', icono: 'bebida', color: 'rojo' };
  }
  if (conc.includes('cerveza') || conc.includes('licor')) {
    return { categoria: 'Bebidas', icono: 'botella', color: 'verde' };
  }
  if (conc.includes('snack') || conc.includes('mecato') || conc.includes('papas')) {
    return { categoria: 'Snack', icono: 'cubiertos', color: 'rojo' };
  }
  if (conc.includes('llave')) {
    return { categoria: 'Llave', icono: 'llave', color: 'rojo' };
  }
  if (conc.includes('limpieza') || conc.includes('aseo')) {
    return { categoria: 'Limpieza', icono: 'spray', color: 'verde' };
  }
  if (c.tipo === 'LAVANDERIA') {
    return { categoria: 'Lavandería', icono: 'lavanderia', color: 'azul' };
  }
  return { categoria: 'Consumo', icono: 'vitrina', color: 'gris' };
}

function Fila({ concepto, valor, total = false }: { concepto: ComponentChildren; valor: number; total?: boolean }) {
  return (
    <div class={`fila${total ? ' fila--total' : ''}`}>
      <div class="fila__txt"><div class="fila__concepto">{concepto}</div></div>
      <div class="fila__valor">{pesos(valor)}</div>
    </div>
  );
}

function Opciones<T extends string>({ opciones, actual, alElegir }: { opciones: Array<[T, string]>; actual: T; alElegir: (v: T) => void }) {
  return (
    <div class="segmentado">
      {opciones.map(([v, t]) => (
        <button key={v} type="button" class="opcion" aria-pressed={actual === v} onClick={() => alElegir(v)}>{['NEQUI', 'BANCOLOMBIA'].includes(v) && <Ico id={v.toLowerCase()} clase="ico--s" />}{t}</button>
      ))}
    </div>
  );
}

function VistaPago({ medio, alMedio, valor, alValor, saldo, escrito, pago }: {
  medio: Medio; alMedio: (m: Medio) => void; valor: string; alValor: (v: string) => void; saldo: number; escrito: number; pago: { valor: number };
}) {
  const cambio = cambioEfectivo(saldo, escrito);
  return (
    <section class="tarjeta">
      <div class="tarjeta__cab"><h3>Medio de pago</h3></div>
      <Opciones opciones={MEDIOS.map((m) => [m, textoMedio(m)] as [Medio, string])} actual={medio} alElegir={alMedio} />
      <div class="campo">
        <label htmlFor="valor-pago">{medio === 'EFECTIVO' ? 'Valor recibido' : 'Valor de la transferencia'}</label>
        <input id="valor-pago" inputmode="numeric" autocomplete="off" placeholder={String(saldo)} value={valor} onInput={(ev) => alValor((ev.target as HTMLInputElement).value)} />
      </div>
      {medio === 'EFECTIVO' ? (
        <div class={`saldo ${cambio.tipo === 'abono' ? 'saldo--aviso' : 'saldo--ok'}`}>
          <div>
            <b>{textoCambio(cambio.tipo, 'Abono: sigue debiendo')}</b>
            <p>Entran {pesos(pago.valor)} a la caja.</p>
          </div>
          <strong>{pesos(cambio.valor)}</strong>
        </div>
      ) : (
        <p class="ayuda">Quedará «por verificar» hasta que la administración confirme que llegó.</p>
      )}
      <p class="ayuda">Saldo pendiente: {pesos(saldo)}</p>
    </section>
  );
}

function VistaSalida({ c, lavanderia, ir }: { c: Estadia['cuenta']; lavanderia: number; ir: (s: Sub) => void }) {
  return (
    <>
      {lavanderia > 0 && (
        <div class="nota nota--alerta" role="alert">
          <Ico id="lavanderia" clase="ico--s" />
          <p>Tiene ropa en lavandería por entregar ({lavanderia === 1 ? '1 pedido' : `${lavanderia} pedidos`}). Entréguesela antes de que se vaya.</p>
        </div>
      )}
      <section class="tarjeta tarjeta--crema">
        <Fila concepto="Total cargos" valor={c.total_cargos} />
        <Fila concepto="Pagado" valor={c.pagado + c.por_verificar} />
        <Fila concepto={c.saldo ? 'Falta pagar' : 'Saldo'} valor={c.saldo} total />
      </section>
      {c.saldo > 0 && (
        <>
          <div class="saldo saldo--alerta">
            <div>
              <b>Nadie sale debiendo</b>
              <p>Cobre el saldo antes de dar la salida. Si no paga, avise a la administradora.</p>
            </div>
            <strong>{pesos(c.saldo)}</strong>
          </div>
          <button type="button" class="btn btn--primario btn--l btn--bloque" onClick={() => ir('pago')}>
            <Ico id="efectivo" clase="ico--s" />Cobrar {pesos(c.saldo)}
          </button>
        </>
      )}
      {c.por_verificar > 0 && (
        <div class="nota">
          <Ico id="alerta" clase="ico--s" />
          <p>Hay {pesos(c.por_verificar)} en transferencias por verificar. La habitación se entrega igual; si la administración dice que no llegó, se le avisará.</p>
        </div>
      )}
      <div class="nota">
        <Ico id="lupa" clase="ico--s" />
        <p>La habitación pasa a «Por revisar» antes de volver a ofrecerse.</p>
      </div>
    </>
  );
}

function VistaExtender({ modExt, alModExt, horas, alHoras, cotExt, reglas }: {
  modExt: ModExt; alModExt: (m: ModExt) => void; horas: number; alHoras: (h: number) => void; cotExt: CotizacionExtension | null; reglas: Pick<Reglas, 'valor_hora'> | null;
}) {
  const r = cotExt && resumenExtension(cotExt, hoyBogota());
  return (
    <>
      <section class="tarjeta">
        <div class="tarjeta__cab"><h3>¿Cómo desea continuar?</h3></div>
        <Opciones opciones={MODALIDADES_EXT} actual={modExt} alElegir={alModExt} />
        {modExt === 'POR_HORAS' && (
          <div class="campo">
            <span>Horas</span>
            <div class="contador">
              <button type="button" aria-label="Restar hora" disabled={horas <= 1} onClick={() => alHoras(horas - 1)}>−</button>
              <output>{cuantos(horas, 'hora', 'horas')}</output>
              <button type="button" aria-label="Sumar hora" disabled={horas >= 12} onClick={() => alHoras(horas + 1)}>+</button>
            </div>
            <span class="ayuda">{ayudaHoras(reglas)}</span>
          </div>
        )}
      </section>
      {r?.aviso && <div class="saldo saldo--aviso"><div><b>{r.aviso}</b><p>La noche completa reemplaza las horas.</p></div></div>}
      {cotExt && r && (
        <section class="tarjeta tarjeta--crema" aria-live="polite">
          <Fila concepto="Valor de la extensión" valor={cotExt.valor} total />
          <p class="ayuda" style="margin-top:10px"><b>Nueva salida: {r.salida}</b></p>
        </section>
      )}
    </>
  );
}

function VistaDevolucion({ d, motivo, alMotivo, medio, alMedio, esAdmin }: {
  d: ReturnType<typeof devolucionPosible>; motivo: MotivoDev; alMotivo: (m: MotivoDev) => void; medio: MedioDev; alMedio: (m: MedioDev) => void; esAdmin: boolean;
}) {
  return (
    <>
      <div class="nota nota--info">
        <Ico id="info" clase="ico--s" />
        <p>Si solo miró la habitación, se devuelve todo. Si ya la usó (se instaló o se acostó), no se devuelve nada. Si pagó por transferencia sin confirmar, espere a la administración.</p>
      </div>
      <section class="tarjeta">
        <div class="tarjeta__cab"><h3>Motivo</h3></div>
        <Opciones opciones={[['SOLO_MIRO', 'Solo la miró'], ['YA_USO', 'Ya la usó']]} actual={motivo} alElegir={alMotivo} />
        {esAdmin && d.valor > 0 && (
          <div class="campo">
            <span>¿Cómo se devuelve?</span>
            <Opciones opciones={[['EFECTIVO', 'En efectivo (sale de la caja)'], ['TRANSFERENCIA', 'Por transferencia']]} actual={medio} alElegir={alMedio} />
          </div>
        )}
      </section>
      {d.bloqueo ? (
        <div class="saldo saldo--aviso"><div><b>Todavía no se puede devolver</b><p>{d.bloqueo}</p></div></div>
      ) : (
        <div class={`saldo ${d.valor ? 'saldo--alerta' : 'saldo--ok'}`}>
          <div>
            <b>{d.valor ? 'Se le devuelve' : 'No se devuelve nada'}</b>
            <p>{textoDevolucion(d.valor, medio)}</p>
          </div>
          <strong>{pesos(d.valor)}</strong>
        </div>
      )}
      <p class="ayuda">La devolución queda unida a esta estadía para que no se cuente como ingreso ni se devuelva dos veces.</p>
    </>
  );
}

function BotonPie({ peligro = false, deshabilitado, alTocar, icono, children }: {
  peligro?: boolean; deshabilitado: boolean; alTocar: () => void; icono: string; children: ComponentChildren;
}) {
  return (
    <button type="button" class={`btn ${peligro ? 'btn--peligro' : 'btn--primario'} btn--l btn--bloque`} disabled={deshabilitado} onClick={alTocar}>
      <Ico id={icono} clase="ico--s" />{children}
    </button>
  );
}

export function Ficha({
  habitacion,
  recarga,
  reglas,
  esAdmin = false,
  inicio = 'cuenta',
  alCerrar,
  alCambiar,
  alSalir,
}: {
  habitacion: Habitacion;
  recarga: number;
  reglas: Pick<Reglas, 'valor_hora'> | null;
  esAdmin?: boolean;
  inicio?: 'cuenta' | 'salida' | 'extender';
  alCerrar: () => void;
  alCambiar: () => void;
  alSalir: (texto: string) => void;
}) {
  const id = habitacion.estadia_activa!.id;
  const [est, setEst] = useState<Estadia | null>(null);
  const [sub, setSub] = useState<Sub>(inicio);
  const [pestana, setPestana] = useState<PestanaFicha>('cuenta');
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [medio, setMedio] = useState<Medio>('EFECTIVO');
  const [valor, setValor] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [clave, setClave] = useState(nuevaClave);
  const [modExt, setModExt] = useState<ModExt>('POR_HORAS');
  const [horas, setHoras] = useState(1);
  const [cotExt, setCotExt] = useState<CotizacionExtension | null>(null);
  const [anulando, setAnulando] = useState<QueAnular | null>(null);
  const [motivoDev, setMotivoDev] = useState<MotivoDev>('SOLO_MIRO');
  const [medioDev, setMedioDev] = useState<MedioDev>('EFECTIVO');

  useEffect(() => {
    api.estadia(id).then(setEst).catch((e: Error) => setError(e.message));
  }, [id, recarga]);

  useEffect(() => {
    api.productos().then((r) => setCatalogo(r.items)).catch(() => {});
  }, []);

  useEffect(() => {
    if (sub !== 'extender') return;
    let vigente = true;
    setCotExt(null);
    api.cotizarExtension(id, modExt === 'POR_HORAS' ? { modalidad: modExt, horas } : { modalidad: modExt })
      .then((c) => { if (vigente) { setCotExt(c); setError(''); } })
      .catch((e: Error) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [sub, modExt, horas]);

  function ir(s: Sub) {
    setSub(s);
    setError('');
    setClave(nuevaClave());
    if (s === 'cargo' || s === 'lavanderia') setCantidades({});
    if (s === 'pago') { setMedio('EFECTIVO'); setValor(''); }
    if (s === 'extender') { setModExt('POR_HORAS'); setHoras(1); }
    if (s === 'devolucion') { setMotivoDev('SOLO_MIRO'); setMedioDev('EFECTIVO'); }
  }

  async function enviar(accion: () => Promise<unknown>, alTerminar?: (r: unknown) => void, alFallar?: () => Promise<void>) {
    setEnviando(true);
    setError('');
    try {
      const r = await accion();
      if (alTerminar) { alTerminar(r); return; }
      alCambiar();
      setEst(await api.estadia(id));
      ir('cuenta');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : SIN_CONEXION);
      await alFallar?.();
    } finally {
      setEnviando(false);
    }
  }

  // Agrega un producto rápido de un solo clic desde la barra derecha
  const sumar = (pid: string, paso: number) => setCantidades({ ...cantidades, [pid]: Math.max(0, Math.min(20, (cantidades[pid] ?? 0) + paso)) });
  const e = est;
  const prendas = catalogo.filter((p) => p.grupo === 'LAVANDERIA');
  const otros = catalogo.filter((p) => p.activo && ['NEVERA', 'OTROS'].includes(p.grupo)).sort((a,b) => Number(b.grupo === 'OTROS') - Number(a.grupo === 'OTROS'));
  const sel = resumenSeleccion(sub === 'lavanderia' ? prendas : otros, cantidades);
  const saldo = e?.cuenta.saldo ?? 0;
  const escrito = leerPesos(valor) ?? saldo;
  const pago = valorPago(medio, saldo, escrito);
  const devolucion = e ? devolucionPosible(e.pagos, motivoDev, esAdmin) : null;

  // Si está en un subflujo (formulario de pago, cargo, etc.) renderizamos el subpanel con botón de retorno
  function panelAccion() {
    if (sub === 'cuenta') return null;
    function vistaSub(): { cuerpo: ComponentChildren; pie: ComponentChildren } {
      if (sub === 'lavanderia') {
        const texto = sel.items.length ? `Recibir ropa · ${pesos(sel.total)}` : 'Elija las prendas';
        return {
          cuerpo: (
            <>
              <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>El lavado se carga a la cuenta de la habitación. Cuando el huésped recoja la ropa en recepción, se cobra al entregarla.</p></div>
              <SelectorProductos catalogo={prendas} cantidades={cantidades} sel={sel} sumar={sumar} />
            </>
          ),
          pie: <BotonPie icono="mas" deshabilitado={!sel.items.length || enviando} alTocar={() => enviar(() => api.pedirLavanderia(id, sel.items.map((x) => ({ producto_id: x.producto.id, cantidad: x.cantidad }))))}>{texto}</BotonPie>,
        };
      }
      if (sub === 'cargo') {
        const texto = sel.items.length ? `Agregar ${cuantos(sel.items.length, 'producto', 'productos')} · ${pesos(sel.total)}` : 'Elija productos';
        return {
          cuerpo: (
            <>
              {!esAdmin && <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>{AVISO_DANO_RECEPCION}</p></div>}
              <SelectorProductos catalogo={otros} cantidades={cantidades} sel={sel} sumar={sumar} />
            </>
          ),
          pie: <BotonPie icono="mas" deshabilitado={!sel.items.length || enviando} alTocar={() => enviar(() => api.agregarCargos(id, sel.items.map((x) => ({ producto_id: x.producto.id, cantidad: x.cantidad })), clave))}>{texto}</BotonPie>,
        };
      }
      if (sub === 'factura') return { cuerpo: <VistaFactura estadiaId={id} />, pie: null };
      if (sub === 'dano') return { cuerpo: <VistaDano estadiaId={id} alListo={async () => { alCambiar(); setEst(await api.estadia(id)); ir('cuenta'); }} />, pie: null };
      if (sub === 'cambio') return { cuerpo: <VistaCambio estadiaId={id} actual={habitacion.numero} alCambiar={(texto) => { alCambiar(); alSalir(texto); }} />, pie: null };
      if (!e) return { cuerpo: null, pie: null };
      switch (sub) {
        case 'pago':
          return {
            cuerpo: <VistaPago medio={medio} alMedio={setMedio} valor={valor} alValor={setValor} saldo={saldo} escrito={escrito} pago={pago} />,
            pie: <BotonPie icono="check" deshabilitado={enviando || pago.valor < 1} alTocar={() => enviar(() => api.registrarPago(id, medio, pago.valor, clave))}>Registrar pago de {pesos(pago.valor)}</BotonPie>,
          };
        case 'salida':
          return {
            cuerpo: <VistaSalida c={e.cuenta} lavanderia={e.lavanderia_por_entregar} ir={ir} />,
            pie: <BotonPie icono="salida" deshabilitado={e.cuenta.saldo > 0 || enviando} alTocar={() => enviar(() => api.darSalida(id), () => alSalir(`Salida registrada. La habitación ${habitacion.numero} queda por revisar.`), async () => setEst(await api.estadia(id).catch(() => e)))}>{e.cuenta.saldo > 0 ? 'Primero cobre el saldo' : 'Dar salida'}</BotonPie>,
          };
        case 'extender':
          return {
            cuerpo: <VistaExtender modExt={modExt} alModExt={setModExt} horas={horas} alHoras={setHoras} cotExt={cotExt} reglas={reglas} />,
            pie: <BotonPie icono="reloj" deshabilitado={!cotExt || enviando} alTocar={() => enviar(() => api.extender(id, modExt === 'POR_HORAS' ? { modalidad: modExt, horas } : { modalidad: modExt }, clave))}>{cotExt ? `Extender · ${pesos(cotExt.valor)}` : 'Calculando…'}</BotonPie>,
          };
        case 'devolucion': {
          const d = devolucion!;
          return {
            cuerpo: <VistaDevolucion d={d} motivo={motivoDev} alMotivo={setMotivoDev} medio={medioDev} alMedio={setMedioDev} esAdmin={esAdmin} />,
            pie: <BotonPie peligro icono="devolver" deshabilitado={!!d.bloqueo || enviando} alTocar={() => enviar(() => api.desistir(id, { motivo: motivoDev, medio: medioDev }, clave), (r) => alSalir(textoDesistimiento(habitacion.numero, r as { valor: number; medio: string | null })))}>{d.valor && !d.bloqueo ? `Registrar devolución de ${pesos(d.valor)}` : 'Registrar desistimiento'}</BotonPie>,
          };
        }
        default:
          return { cuerpo: null, pie: null };
      }
    }

    const { cuerpo: subCuerpo, pie: subPie } = vistaSub();
    return (
      <Panel titulo={tituloFicha(sub, habitacion.numero)} subtitulo={'Habitación ' + habitacion.numero} alCerrar={() => inicio !== 'cuenta' ? (sub === inicio ? alCerrar() : ir(inicio)) : ir('cuenta')} error={error} pie={subPie}>
        {subCuerpo}
      </Panel>
    );
  }

  // ── Vista Grande de Cuenta y Salida (Imagen 2) ───────────────────────────
  const cargosVigentes = e ? e.cargos.filter((c) => !c.anulado) : [];
  const pagosVigentes = e ? e.pagos.filter((p) => !p.anulado) : [];
  const codigoReserva = e ? `#E-${e.id.slice(0, 8).toUpperCase()}` : 'Cargando…';

  return (
    <>{inicio === 'cuenta' && <Panel titulo={`Cuenta · Habitación ${habitacion.numero}`} ancho="cuenta" alCerrar={alCerrar} error={sub === 'cuenta' ? error : ''}>
      <div class="ficha-pantalla-grande">
        {/* Barra superior con migas y botón de cerrar */}
        <div class="ficha-pg-topbar">
          <div class="ficha-pg-migas">
            <span>Habitaciones</span>
            <span class="separador-miga">›</span>
            <strong>Habitación {habitacion.numero}</strong>
          </div>
          <button
            type="button"
            class="ficha-pg-cerrar-btn"
            aria-label="Cerrar vista completa"
            onClick={alCerrar}
          >
            <Ico id="cerrar" clase="ico--s" />
          </button>
        </div>

        {/* Encabezado amplio con foto y datos de la estadía */}
        <header class="ficha-pg-header">
          <div class="ficha-pg-header__foto">
            <FotoHabitacion
              numero={habitacion.numero}
              altura={155}
              editable={false}
            />
          </div>

          <div class="ficha-pg-header__info-principal">
            <div class="ficha-pg-header__hab-titulo">
              <h2>Habitación {habitacion.numero}</h2>
              <span class="ficha-pg-badge-estado">Ocupada</span>
            </div>
            <div class="ficha-pg-header__datos-huesped">
              <div class="ficha-pg-huesped-fila">
                <Ico id="usuario" clase="ico--xs" />
                <span class="ficha-pg-huesped-nombre">{e?.huesped.nombre_mostrado ?? 'Cargando huésped…'}</span>
              </div>
              <div class="ficha-pg-huesped-fila">
                <Ico id="telefono" clase="ico--xs" />
                <span>Teléfono no disponible</span>
              </div>
              <div class="ficha-pg-huesped-fila">
                <Ico id="nuevo-doc" clase="ico--xs" />
                <span>Estadía {codigoReserva}</span>
              </div>
              <div class="ficha-pg-huesped-fila">
                <Ico id="usuarios" clase="ico--xs" />
                <span>{cuantos(e?.personas ?? 1, 'adulto', 'adultos')}</span>
              </div>
            </div>
          </div>

          <div class="ficha-pg-header__columna">
            <span class="ficha-pg-col-label">Entrada</span>
            <div class="ficha-pg-col-fecha">
              <Ico id="calendario" clase="ico--xs ico--rojo-marca" />
              <strong>{e ? fechaLarga(e.entrada_en) : '—'}</strong>
            </div>
            <span class="ficha-pg-col-hora">{e ? horaBogota(e.entrada_en) : '—'}</span>
          </div>

          <div class="ficha-pg-header__columna">
            <span class="ficha-pg-col-label">Salida planificada</span>
            <div class="ficha-pg-col-fecha">
              <Ico id="calendario" clase="ico--xs ico--rojo-marca" />
              <strong>{e ? fechaLarga(e.salida_prevista_en) : '—'}</strong>
            </div>
            <span class="ficha-pg-col-hora">{e ? horaBogota(e.salida_prevista_en) : '—'}</span>
            <span class="ficha-pg-col-pill">{cuantos(e?.noches ?? 1, 'noche', 'noches')}</span>
          </div>

          <div class="ficha-pg-header__columna">
            <span class="ficha-pg-col-label">Estado de estadía</span>
            <div class="ficha-pg-col-fecha">
              <Ico id="habitaciones" clase="ico--xs ico--rojo-marca" />
              <strong class="texto-estado--en-curso">En curso</strong>
            </div>
            <span class="ficha-pg-col-hora">{cuantos(e?.noches ?? 1, 'noche', 'noches')} registradas</span>
          </div>
        </header>

        {/* Pestañas horizontales (Imagen 2) */}
        <nav class="ficha-pg-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class={`ficha-pg-tab ${pestana === 'cuenta' ? 'ficha-pg-tab--activo' : ''}`}
            aria-selected={pestana === 'cuenta'}
            onClick={() => setPestana('cuenta')}
          >
            <Ico id="facturacion" clase="ico--xs" />
            <span>Cuenta</span>
          </button>
          <button
            type="button"
            role="tab"
            class={`ficha-pg-tab ${pestana === 'huesped' ? 'ficha-pg-tab--activo' : ''}`}
            aria-selected={pestana === 'huesped'}
            onClick={() => setPestana('huesped')}
          >
            <Ico id="usuario" clase="ico--xs" />
            <span>Huésped</span>
          </button>
          <button
            type="button"
            role="tab"
            class={`ficha-pg-tab ${pestana === 'historial' ? 'ficha-pg-tab--activo' : ''}`}
            aria-selected={pestana === 'historial'}
            onClick={() => setPestana('historial')}
          >
            <Ico id="reloj" clase="ico--xs" />
            <span>Historial</span>
          </button>
          <button
            type="button"
            role="tab"
            class={`ficha-pg-tab ${pestana === 'notas' ? 'ficha-pg-tab--activo' : ''}`}
            aria-selected={pestana === 'notas'}
            onClick={() => setPestana('notas')}
          >
            <Ico id="nuevo-doc" clase="ico--xs" />
            <span>Notas</span>
          </button>
          <button
            type="button"
            role="tab"
            class={`ficha-pg-tab ${pestana === 'llave' ? 'ficha-pg-tab--activo' : ''}`}
            aria-selected={pestana === 'llave'}
            onClick={() => setPestana('llave')}
          >
            <Ico id="llave" clase="ico--xs" />
            <span>Llave</span>
          </button>
          <button
            type="button"
            role="tab"
            class={`ficha-pg-tab ${pestana === 'limpieza' ? 'ficha-pg-tab--activo' : ''}`}
            aria-selected={pestana === 'limpieza'}
            onClick={() => setPestana('limpieza')}
          >
            <Ico id="escoba" clase="ico--xs" />
            <span>Limpieza</span>
          </button>
        </nav>

        {/* Notificación de registro tardío si aplica */}
        {e?.registro_tardio && (
          <div class="nota nota--aviso" style="margin: 12px 0 0">
            <Ico id="talonario" clase="ico--s" />
            <p>{textoTardio(e)}</p>
          </div>
        )}

        {/* Contenido principal según pestaña */}
        {pestana === 'cuenta' ? (
          <div class="ficha-pg-grid">
            {/* ── COLUMNA IZQUIERDA: Tablas de Cargos y Pagos ── */}
            <div class="ficha-pg-col-izq">
              {/* Tarjeta: Cargos de la habitación */}
              <div class="ficha-pg-card">
                <div class="ficha-pg-card__cabecera">
                  <h3>Cargos de la habitación</h3>
                  <button
                    type="button"
                    class="ficha-btn-rojo-sm"
                    onClick={() => ir('cargo')}
                  >
                    <Ico id="mas" clase="ico--xs" />
                    <span>Agregar cargo</span>
                  </button>
                </div>

                <div class="ficha-pg-tabla-wrapper">
                  <table class="ficha-pg-tabla ficha-pg-tabla--cargos">
                    <thead>
                      <tr>
                        <th>Fecha y hora</th>
                        <th>Descripción</th>
                        <th>Categoría</th>
                        <th>Cant.</th>
                        <th>Valor unitario</th>
                        <th>Total</th>
                        <th class="th--accion">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargosVigentes.length === 0 ? (
                        <tr><td colspan={7} class="td--vacio">No hay cargos registrados.</td></tr>
                      ) : (
                        cargosVigentes.map((c) => {
                          const cat = categorizarCargo(c);
                          const cant = c.cantidad > 0 ? c.cantidad : 1;
                          const unitario = c.valor_unitario > 0 ? c.valor_unitario : Math.round(c.valor / cant);
                          return (
                            <tr key={c.id}>
                              <td data-label="Fecha y hora" class="td--fecha">{cuando(c.creado_en)}</td>
                              <td data-label="Descripción" class="td--desc"><strong>{c.concepto}</strong></td>
                              <td data-label="Categoría">
                                <span class={`ficha-pg-cat-badge ficha-pg-cat-badge--${cat.color}`}>
                                  <Ico id={cat.icono} clase="ico--xs" />
                                  <span>{cat.categoria}</span>
                                </span>
                              </td>
                              <td data-label="Cantidad" class="td--centro">{cant}</td>
                              <td data-label="Valor unitario" class="td--num">{pesos(unitario)}</td>
                              <td data-label="Total" class="td--num td--bold">{pesos(c.valor)}</td>
                              <td data-label="Acciones" class="td--accion">
                                <details class="cargo-detalle">
                                  <summary aria-label={`Detalle de ${c.concepto}`}><Ico id="puntos-v" clase="ico--xs" /></summary>
                                  <p>{c.concepto} · {cant} × {pesos(unitario)} = {pesos(c.valor)}<br />{cuando(c.creado_en)}</p>
                                </details>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tarjeta: Pagos realizados */}
              <div class="ficha-pg-card ficha-pg-card--pagos">
                <div class="ficha-pg-card__cabecera">
                  <h3>Pagos realizados</h3>
                  <button
                    type="button"
                    class="ficha-btn-rojo-sm"
                    disabled={e?.cuenta.saldo === 0}
                    onClick={() => ir('pago')}
                  >
                    <Ico id="mas" clase="ico--xs" />
                    <span>Registrar pago</span>
                  </button>
                </div>

                <div class="ficha-pg-tabla-wrapper">
                  <table class="ficha-pg-tabla ficha-pg-tabla--pagos">
                    <thead>
                      <tr>
                        <th>Fecha y hora</th>
                        <th>Método</th>
                        <th>Referencia</th>
                        <th>Valor</th>
                        <th class="th--accion">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagosVigentes.length === 0 ? (
                        <tr><td colspan={5} class="td--vacio">Sin pagos registrados.</td></tr>
                      ) : (
                        pagosVigentes.map((p) => {
                          const pill = pillEstadoPago(p.estado, 'Llegó');
                          return (
                            <tr key={p.id}>
                              <td data-label="Fecha y hora" class="td--fecha">{cuando(p.registrado_en)}</td>
                              <td data-label="Método">
                                <span class="ficha-pg-metodo-badge">
                                  <Ico id={p.medio === 'EFECTIVO' ? 'efectivo' : p.medio === 'NEQUI' ? 'nequi' : 'bancolombia'} clase="ico--xs" />
                                  <span>{textoMedio(p.medio)}</span>
                                </span>
                              </td>
                              <td data-label="Referencia" class="td--ref">{p.id.slice(0, 7)}</td>
                              <td data-label="Valor" class="td--num td--bold">{pesos(p.valor)}</td>
                              <td data-label="Estado y acciones" class="td--accion">
                                {pill && <span class={`pill ${pill[0]}`} style="font-size:11px; margin-right:4px">{pill[1]}</span>}
                                {esAdmin && (
                                  <button
                                    type="button"
                                    class="ficha-pg-btn-puntos"
                                    title="Anular pago"
                                    onClick={() => setAnulando({ id: p.id, origen: 'PAGO', concepto: `Cobro · Hab. ${habitacion.numero} · ${textoMedio(p.medio)}`, valor: p.valor })}
                                  >
                                    <Ico id="puntos-v" clase="ico--xs" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── COLUMNA DERECHA: Productos rápidos, Métodos, Resumen y Acciones ── */}
            <div class="ficha-pg-col-der">
              {/* Tarjeta: Productos y cargos rápidos */}
              <div class="ficha-pg-card">
                <div class="ficha-pg-card__cabecera">
                  <h3>Productos y cargos rápidos</h3>
                  <button type="button" class="ficha-pg-link-ver" onClick={() => ir('cargo')}>
                    Ver todos
                  </button>
                </div>
                <div class="ficha-pg-cargos-rapidos-grid">{otros.slice(0, 6).map((producto) =>
                  <div key={producto.id} class="producto-rapido">
                    <FotoHabitacion numero={`producto-${producto.id}`} etiqueta={`producto ${producto.nombre}`} vacio editable={esAdmin} fotoInicial={FOTOS_PRODUCTOS[producto.nombre.trim().toLowerCase()]} />
                    <button type="button" class="producto-rapido__agregar" aria-label={`Agregar ${producto.nombre} a la cuenta`} onClick={() => { ir('cargo'); setCantidades({ [producto.id]: 1 }); }}>
                      <span><strong>{producto.nombre}</strong><small>{pesos(producto.precio)}</small></span><span class="producto-rapido__mas"><Ico id="mas" clase="ico--s" /></span>
                    </button>
                  </div>)}</div>
                {!otros.length && <p class="ayuda">Sin cargos del MVP en el catálogo. Los importes se toman del sistema; no se suponen precios.</p>}
                <p class="ayuda">Vitrina, lavandería y facturación: entregas futuras.</p>
              </div>

              {/* Tarjeta: Métodos de pago */}
              <div class="ficha-pg-card ficha-pg-card--metodos">
                <div class="ficha-pg-card__cabecera">
                  <h3>Métodos de pago</h3>
                </div>
                <div class="ficha-pg-metodos-grid">
                  <button
                    type="button"
                    class="metodo-pago-pill"
                    onClick={() => { setMedio('EFECTIVO'); ir('pago'); }}
                  >
                    <Ico id="efectivo" clase="ico--s" />
                    <span>Efectivo</span>
                  </button>
                  <button
                    type="button"
                    class="metodo-pago-pill"
                    onClick={() => { ir('pago'); setMedio('NEQUI'); }}
                  >
                    <Ico id="nequi" clase="ico--s" />
                    <span>Nequi</span>
                  </button>
                  <button
                    type="button"
                    class="metodo-pago-pill"
                    onClick={() => { ir('pago'); setMedio('BANCOLOMBIA'); }}
                  >
                    <Ico id="bancolombia" clase="ico--s" />
                    <span>Bancolombia</span>
                  </button>
                </div>
                <BancosAdicionales />
              </div>

              {/* Tarjeta: Resumen de cuenta */}
              <div class="ficha-pg-card ficha-pg-card--resumen">
                <div class="ficha-pg-card__cabecera">
                  <h3>Resumen de cuenta</h3>
                </div>
                <div class="ficha-pg-resumen-lista">
                  <div class="resumen-fila">
                    <span>Total cargos</span>
                    <strong>{pesos(e?.cuenta.total_cargos ?? 0)}</strong>
                  </div>
                  <div class="resumen-fila resumen-fila--verde">
                    <span>Total pagos</span>
                    <strong>- {pesos((e?.cuenta.pagado ?? 0) + (e?.cuenta.por_verificar ?? 0))}</strong>
                  </div>
                  <div class="resumen-fila resumen-fila--saldo">
                    <span>Saldo pendiente</span>
                    <strong class="resumen-saldo-destacado">{pesos(e?.cuenta.saldo ?? 0)}</strong>
                  </div>
                </div>
              </div>

              {/* Tarjeta: Acciones de estadía */}
              <div class="ficha-pg-card">
                <div class="ficha-pg-card__cabecera">
                  <h3>Acciones de estadía</h3>
                </div>
                <div class="ficha-pg-acciones-estadia">
                  <button
                    type="button"
                    class="accion-estadia-btn accion-estadia-btn--crema"
                    onClick={() => ir('cargo')}
                  >
                    <span class="accion-estadia-ico"><Ico id="mas" clase="ico--s" /></span>
                    <div class="accion-estadia-txt">
                      <strong>Agregar cargo</strong>
                      <span>Consumos o servicios adicionales</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    class="accion-estadia-btn"
                    onClick={() => ir('pago')}
                  >
                    <span class="accion-estadia-ico"><Ico id="tarjeta-pago" clase="ico--s" /></span>
                    <div class="accion-estadia-txt">
                      <strong>Registrar pago</strong>
                      <span>Abono a la cuenta de la habitación</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    class="accion-estadia-btn"
                    onClick={() => ir('extender')}
                  >
                    <span class="accion-estadia-ico"><Ico id="reloj" clase="ico--s" /></span>
                    <div class="accion-estadia-txt">
                      <strong>Extender estadía</strong>
                      <span>Modificar fecha de salida</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    class="accion-estadia-btn accion-estadia-btn--rojo"
                    onClick={() => ir('salida')}
                  >
                    <span class="accion-estadia-ico"><Ico id="salida" clase="ico--s" /></span>
                    <div class="accion-estadia-txt">
                      <strong>Registrar salida</strong>
                      <span>Cerrar estadía y generar cuenta</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Pestañas secundarias */
          <div class="ficha-pg-card" style="margin-top:16px; padding:24px;">
            <h3>Detalles de {pestana}</h3>
            <p class="ayuda">Información y opciones avanzadas de la habitación {habitacion.numero}.</p>
            <div class="ficha-pg-acciones-estadia" style="max-width:400px; margin-top:16px;">
              <button type="button" class="btn btn--secundario" disabled title="Módulo futuro">
                <Ico id="lavanderia" clase="ico--s" /> Lavandería · Futuro
              </button>
              <button type="button" class="btn btn--secundario" onClick={() => ir('cambio')}>
                <Ico id="habitaciones" clase="ico--s" /> Cambiar de habitación
              </button>
              <button type="button" class="btn btn--secundario" disabled title="Módulo futuro">
                <Ico id="facturacion" clase="ico--s" /> Facturación · Futuro
              </button>
              <button type="button" class="btn btn--secundario" onClick={() => ir('devolucion')}>
                <Ico id="devolver" clase="ico--s" /> Desistimiento y devolución
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación de anulación */}
      {anulando && (
        <Anular
          que={anulando}
          alCerrar={() => setAnulando(null)}
          alAnular={async () => {
            setAnulando(null);
            alCambiar();
            setEst(await api.estadia(id));
          }}
        />
      )}
    </Panel>}{panelAccion()}</>
  );
}
