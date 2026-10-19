// Ajustes (TICKET-15, FR-22): la administración cambia tarifas, reglas y productos.
// Todo aplica a lo nuevo: las entradas, cargos y turnos ya registrados conservan su valor.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi } from '../api.ts';
import { horaBogota, leerPesos, pesos, type Producto } from '../logica.ts';
import { fechaReporte } from '../reportes.ts';
import {
  erroresProducto, etiquetaTarifa, GRUPOS_EDITABLES, leerCantidadSurtido, NOTA_FAMILIAR, REGLAS, reglasCambiadas, tarifasCambiadas, textoHora,
  type ClaveRegla, type Reglas, type Tarifa,
} from '../ajustes.ts';
import { AvisoHotel } from './AjustesAviso.tsx';
import { Ico } from './Ico.tsx';
import type { Existencia } from '../avisos.ts';

export type Seccion = 'tarifas' | 'reglas' | 'productos' | 'existencias' | 'aviso';
const mensaje = (e: unknown) => e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo.';
const HORAS = Array.from({ length: 12 }, (_, i) => 12 + i);

function AvisoError({ texto }: { texto: string }) {
  return texto ? <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{texto}</p></div> : null;
}

function Tarifas({ alGuardar }: { alGuardar: (texto: string) => void }) {
  const [tarifas, setTarifas] = useState<Tarifa[] | null>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const cargar = () => api.tarifas().then((r) => {
    setTarifas(r.items);
    setTextos(Object.fromEntries(r.items.map((t) => [t.id, String(t.valor)])));
  }).catch((e) => setError(mensaje(e)));
  useEffect(() => { void cargar(); }, []);

  async function guardar(ev: Event) {
    ev.preventDefault();
    if (!tarifas) return;
    const { items, errores: e } = tarifasCambiadas(tarifas, textos);
    setErrores(e);
    if (Object.keys(e).length) return;
    if (items.length === 0) { setError('No cambió ningún valor.'); return; }
    setEnviando(true); setError('');
    try {
      await api.guardarTarifas(items);
      await cargar();
      const cuantas = items.length === 1 ? 'una tarifa cambiada' : `${items.length} tarifas cambiadas`;
      alGuardar(`Listo: ${cuantas}. Aplica a las entradas desde ahora; las ya registradas conservan su valor.`);
    } catch (err) { setError(mensaje(err)); }
    finally { setEnviando(false); }
  }

  if (!tarifas) return <><AvisoError texto={error} />{!error && <p><output>Cargando tarifas…</output></p>}</>;
  return <form class="tarjeta" onSubmit={(ev) => void guardar(ev)}>
    <div class="tarjeta__cab"><h2><Ico id="habitaciones" clase="ico--s" />Tarifas</h2></div>
    <div class="ajustes__rejilla">{tarifas.map((t) => <div class="campo" key={t.id}>
      <label htmlFor={`tarifa-${t.id}`}>{etiquetaTarifa(t)}</label>
      <input id={`tarifa-${t.id}`} inputmode="numeric" autocomplete="off" value={textos[t.id] ?? ''} aria-invalid={!!errores[t.id]}
        onInput={(e) => setTextos({ ...textos, [t.id]: (e.target as HTMLInputElement).value })} />
      {errores[t.id] ? <span class="campo__error">{errores[t.id]}</span>
        : <span class="ayuda">{pesos(leerPesos(textos[t.id] ?? '') ?? 0)} · desde {fechaReporte(t.vigente_desde)}, {horaBogota(t.vigente_desde)}</span>}
    </div>)}</div>
    <p class="ayuda">Tres horas tiene un solo precio para 1 o 2 personas.</p>
    <AvisoError texto={error} />
    <button type="submit" class="btn btn--primario btn--l btn--bloque" disabled={enviando}><Ico id="check" clase="ico--s" />Guardar tarifas</button>
  </form>;
}

function ReglasHotel({ alGuardar }: { alGuardar: (texto: string) => void }) {
  const [reglas, setReglas] = useState<Reglas | null>(null);
  const [textos, setTextos] = useState<Record<ClaveRegla, string> | null>(null);
  const [errores, setErrores] = useState<Partial<Record<ClaveRegla, string>>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const mostrar = (r: Reglas) => { setReglas(r); setTextos(Object.fromEntries(REGLAS.map((x) => [x.clave, String(r[x.clave])])) as Record<ClaveRegla, string>); };
  useEffect(() => { api.reglas().then(mostrar).catch((e) => setError(mensaje(e))); }, []);

  async function guardar(ev: Event) {
    ev.preventDefault();
    if (!reglas || !textos) return;
    const { cambios, errores: e } = reglasCambiadas(reglas, textos);
    setErrores(e);
    if (Object.keys(e).length) return;
    if (Object.keys(cambios).length === 0) { setError('No cambió ningún valor.'); return; }
    setEnviando(true); setError('');
    try {
      mostrar(await api.guardarReglas(cambios));
      alGuardar('Listo: reglas guardadas. Aplican a lo nuevo; lo ya cobrado y el turno en curso no cambian.');
    } catch (err) { setError(mensaje(err)); }
    finally { setEnviando(false); }
  }

  if (!reglas || !textos) return <><AvisoError texto={error} />{!error && <p><output>Cargando reglas…</output></p>}</>;
  return <form class="tarjeta" onSubmit={(ev) => void guardar(ev)}>
    <div class="tarjeta__cab"><h2><Ico id="configuracion" clase="ico--s" />Reglas del hotel</h2></div>
    <div class="ajustes__rejilla">{REGLAS.map((r) => <div class="campo" key={r.clave}>
      <label htmlFor={`regla-${r.clave}`}>{r.texto}</label>
      {r.clave === 'hora_noche_completa'
        ? <select id={`regla-${r.clave}`} value={textos[r.clave]} onChange={(e) => setTextos({ ...textos, [r.clave]: (e.target as HTMLSelectElement).value })}>
          {HORAS.map((h) => <option key={h} value={String(h)}>{textoHora(h)}</option>)}</select>
        : <input id={`regla-${r.clave}`} inputmode="numeric" autocomplete="off" value={textos[r.clave]} aria-invalid={!!errores[r.clave]}
          onInput={(e) => setTextos({ ...textos, [r.clave]: (e.target as HTMLInputElement).value })} />}
      {errores[r.clave] ? <span class="campo__error">{errores[r.clave]}</span> : <span class="ayuda">{r.ayuda}</span>}
    </div>)}</div>
    <AvisoError texto={error} />
    <button type="submit" class="btn btn--primario btn--l btn--bloque" disabled={enviando}><Ico id="check" clase="ico--s" />Guardar reglas</button>
  </form>;
}

function FilaProducto({ p, alGuardar }: { p: Producto; alGuardar: (texto: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ nombre: p.nombre, precio: String(p.precio) });
  const [errores, setErrores] = useState<Partial<Record<'nombre' | 'precio', string>>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function guardar(cambio: Partial<Pick<Producto, 'nombre' | 'precio' | 'activo'>>, texto: string) {
    setEnviando(true); setError('');
    try {
      await api.guardarProducto(p.id, { nombre: p.nombre, grupo: p.grupo, precio: p.precio, pertenece_a: p.pertenece_a,
        ...(p.seccion ? { seccion: p.seccion } : {}), activo: p.activo, ...cambio });
      setEditando(false);
      alGuardar(texto);
    } catch (err) { setError(mensaje(err)); }
    finally { setEnviando(false); }
  }

  function guardarEdicion(ev: Event) {
    ev.preventDefault();
    const e = erroresProducto(f);
    setErrores(e);
    if (Object.keys(e).length) return;
    const precio = leerPesos(f.precio) ?? 0;
    void guardar({ nombre: f.nombre.trim(), precio }, `Listo: «${f.nombre.trim()}» queda en ${pesos(precio)}. Los cargos anteriores conservan su precio.`);
  }

  if (editando) {
    return <div class="mov">
      <form class="producto__form" onSubmit={guardarEdicion}>
      <div class="doble doble--igual">
        <div class="campo"><label htmlFor={`pn-${p.id}`}>Nombre</label>
          <input id={`pn-${p.id}`} maxLength={80} value={f.nombre} aria-invalid={!!errores.nombre} onInput={(e) => setF({ ...f, nombre: (e.target as HTMLInputElement).value })} />
          {errores.nombre && <span class="campo__error">{errores.nombre}</span>}</div>
        <div class="campo"><label htmlFor={`pp-${p.id}`}>Precio</label>
          <input id={`pp-${p.id}`} inputmode="numeric" value={f.precio} aria-invalid={!!errores.precio} onInput={(e) => setF({ ...f, precio: (e.target as HTMLInputElement).value })} />
          {errores.precio && <span class="campo__error">{errores.precio}</span>}</div>
      </div>
      <div class="persona__acciones">
        <button type="submit" class="btn btn--primario btn--mini" disabled={enviando}>Guardar</button>
        <button type="button" class="btn btn--fantasma btn--mini" onClick={() => { setEditando(false); setF({ nombre: p.nombre, precio: String(p.precio) }); }}>Cancelar</button>
      </div>
      <AvisoError texto={error} />
      </form>
    </div>;
  }
  return <div class={`mov${p.activo ? '' : ' mov--anulado'}`}>
      <div class="mov__txt"><div class="mov__titulo">{p.nombre}</div>
        <div class="mov__detalle">{p.activo ? 'A la venta' : 'Fuera del catálogo'}</div></div>
      <div class="mov__der"><span class="mov__valor">{pesos(p.precio)}</span>
        {p.activo && <button type="button" class="btn btn--secundario btn--mini" onClick={() => setEditando(true)}>Editar</button>}
        {p.activo
          ? <button type="button" class="btn btn--fantasma btn--mini" disabled={enviando} onClick={() => void guardar({ activo: false }, `«${p.nombre}» ya no aparece para cobrar. Puede volver a ponerlo cuando quiera.`)}>Quitar</button>
          : <button type="button" class="btn btn--secundario btn--mini" disabled={enviando} onClick={() => void guardar({ activo: true }, `«${p.nombre}» vuelve a estar a la venta.`)}>Volver a poner</button>}
      </div>
      {error && <div class="producto__error"><AvisoError texto={error} /></div>}
  </div>;
}

function NuevoProducto({ alCerrar, alGuardar }: { alCerrar: () => void; alGuardar: (texto: string) => void }) {
  const [f, setF] = useState({ grupo: 'NEVERA', nombre: '', precio: '' });
  const [errores, setErrores] = useState<Partial<Record<'nombre' | 'precio', string>>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function crear(ev: Event) {
    ev.preventDefault();
    const e = erroresProducto(f);
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true); setError('');
    try {
      const p = await api.crearProducto({ nombre: f.nombre.trim(), grupo: f.grupo, precio: leerPesos(f.precio) ?? 0, pertenece_a: 'HOTEL', activo: true });
      alGuardar(`Listo: «${p.nombre}» ya se puede cobrar por ${pesos(p.precio)}.`);
    } catch (err) { setError(mensaje(err)); setEnviando(false); }
  }

  return <form class="tarjeta tarjeta--crema" onSubmit={(ev) => void crear(ev)}>
    <div class="tarjeta__cab"><h3>Agregar producto</h3>
      <button type="button" class="btn btn--fantasma btn--mini" onClick={alCerrar}>Cancelar</button></div>
    <div class="campo"><label htmlFor="np-grupo">¿Dónde está?</label>
      <select id="np-grupo" value={f.grupo} onChange={(e) => setF({ ...f, grupo: (e.target as HTMLSelectElement).value })}>
        {GRUPOS_EDITABLES.map(([g, t]) => <option key={g} value={g}>{t}</option>)}</select></div>
    <div class="doble doble--igual">
      <div class="campo"><label htmlFor="np-nombre">Nombre</label>
        <input id="np-nombre" maxLength={80} autocomplete="off" value={f.nombre} aria-invalid={!!errores.nombre} onInput={(e) => setF({ ...f, nombre: (e.target as HTMLInputElement).value })} />
        {errores.nombre && <span class="campo__error">{errores.nombre}</span>}</div>
      <div class="campo"><label htmlFor="np-precio">Precio</label>
        <input id="np-precio" inputmode="numeric" autocomplete="off" placeholder="Ej. 3500" value={f.precio} aria-invalid={!!errores.precio} onInput={(e) => setF({ ...f, precio: (e.target as HTMLInputElement).value })} />
        {errores.precio && <span class="campo__error">{errores.precio}</span>}</div>
    </div>
    <AvisoError texto={error} />
    <button type="submit" class="btn btn--primario btn--bloque" disabled={enviando}><Ico id="mas" clase="ico--s" />Agregar</button>
  </form>;
}

function Productos({ alGuardar }: { alGuardar: (texto: string) => void }) {
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  useEffect(() => { api.productosTodos().then((r) => setProductos(r.items)).catch((e) => setError(mensaje(e))); }, [recarga]);
  const listo = (texto: string) => { setAgregando(false); setRecarga((n) => n + 1); alGuardar(texto); };

  if (!productos) return <><AvisoError texto={error} />{!error && <p><output>Cargando productos…</output></p>}</>;
  return <section class="tarjeta">
    <div class="tarjeta__cab"><h2><Ico id="vitrina" clase="ico--s" />Productos para cobrar</h2>
      {!agregando && <button type="button" class="btn btn--secundario btn--mini" onClick={() => setAgregando(true)}><Ico id="mas" clase="ico--xs" />Agregar</button>}</div>
    <p class="ayuda">Cambiar un precio no cambia lo que ya se cobró. {NOTA_FAMILIAR}</p>
    {agregando && <NuevoProducto alCerrar={() => setAgregando(false)} alGuardar={listo} />}
    {GRUPOS_EDITABLES.map(([g, t]) => {
      const lista = productos.filter((p) => p.grupo === g);
      return lista.length > 0 && <div key={g}><h3 class="ajustes__grupo">{t}</h3>
        {lista.map((p) => <FilaProducto key={`${p.id}-${p.precio}-${p.activo}-${p.nombre}`} p={p} alGuardar={listo} />)}</div>;
    })}
  </section>;
}

/** Surtido y existencias de nevera y vitrinas (TICKET-21, RN-21): lo que llegó, lo vendido y lo que debería quedar. */
function Existencias({ alGuardar, alCambiar }: { alGuardar: (texto: string) => void; alCambiar?: () => void }) {
  const [items, setItems] = useState<Existencia[] | null>(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [producto, setProducto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [verError, setVerError] = useState(false);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { api.existencias().then((r) => setItems(r.items)).catch((e) => setError(mensaje(e))); }, [recarga]);

  if (!items) return <><AvisoError texto={error} />{!error && <p><output>Cargando existencias…</output></p>}</>;
  const leida = leerCantidadSurtido(cantidad);
  async function anotar(ev: Event) {
    ev.preventDefault();
    setVerError(true);
    if (!producto || leida.cantidad === null) return;
    setEnviando(true);
    setError('');
    try {
      await api.registrarSurtido(producto, leida.cantidad);
      const nombre = items!.find((x) => x.producto_id === producto)?.nombre ?? 'el producto';
      alGuardar(`Listo: se anotaron ${leida.cantidad} de «${nombre}».`);
      setProducto(''); setCantidad(''); setVerError(false); setRecarga((n) => n + 1);
      alCambiar?.(); // la campana recalcula los avisos de existencias
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setEnviando(false);
    }
  }
  return <>
    <form class="tarjeta" onSubmit={anotar}>
      <div class="tarjeta__cab"><h2><Ico id="mas" clase="ico--s" />Llegó mercancía</h2></div>
      <p class="ayuda">Anote lo que llega a la nevera o a las vitrinas. Cada venta o cargo lo descuenta solo.</p>
      <div class="form-rejilla form-rejilla--2">
        <div class="campo"><label htmlFor="surtido-producto">Producto</label>
          <select id="surtido-producto" value={producto} aria-invalid={verError && !producto} onChange={(e) => setProducto((e.target as HTMLSelectElement).value)}>
            <option value="">Elija el producto</option>
            {items.map((x) => <option key={x.producto_id} value={x.producto_id}>{x.nombre}</option>)}
          </select>
          {verError && !producto && <span class="campo__error">Elija el producto que llegó.</span>}</div>
        <div class="campo"><label htmlFor="surtido-cantidad">¿Cuántas unidades?</label>
          <input id="surtido-cantidad" inputmode="numeric" autocomplete="off" placeholder="Ej. 24" value={cantidad} aria-invalid={verError && !!leida.error}
            onInput={(e) => setCantidad((e.target as HTMLInputElement).value)} />
          {verError && leida.error && <span class="campo__error">{leida.error}</span>}</div>
      </div>
      <AvisoError texto={error} />
      <button type="submit" class="btn btn--primario" disabled={enviando}><Ico id="check" clase="ico--s" />Anotar lo que llegó</button>
    </form>
    <section class="tarjeta">
      <div class="tarjeta__cab"><h2><Ico id="vitrina" clase="ico--s" />Cuánto debería quedar</h2></div>
      <p class="ayuda">Lo que llegó menos lo vendido. Si no coincide con lo que hay en la vitrina o la nevera, algo se vendió sin anotar o falta.</p>
      {GRUPOS_EDITABLES.map(([g, t]) => {
        const lista = items.filter((x) => x.grupo === g);
        return lista.length > 0 && <div key={g}><h3 class="ajustes__grupo">{t}</h3>
          {lista.map((x) => <div key={x.producto_id} class="fila">
            <div class="fila__txt"><div class="fila__concepto">{x.nombre}</div>
              <div class="fila__detalle">Llegó {x.surtido} · vendido {x.vendido}</div></div>
            <div class={`fila__valor${x.surtido > 0 && x.existencias <= 0 ? ' negativo' : ''}`}>{x.existencias}</div>
          </div>)}</div>;
      })}
    </section>
  </>;
}

/** `inicial`: la sección que se abre (un aviso de existencias abre «Existencias»). `alCambiar`: avisa que cambió algo que afecta los avisos. */
export function Ajustes({ inicial = 'tarifas', alCambiar }: { inicial?: Seccion; alCambiar?: () => void }) {
  const [seccion, setSeccion] = useState<Seccion>(inicial);
  const [aviso, setAviso] = useState('');
  const elegir = (s: Seccion) => { setSeccion(s); setAviso(''); };
  return <div class="historial">
    <div class="titulo-vista"><div><h1>Ajustes</h1><p>Precios y reglas del hotel. Los cambios aplican a lo nuevo: lo ya cobrado no cambia.</p></div></div>
    <div class="segmentado" aria-label="Qué ajustar">
      <button type="button" class="opcion" aria-pressed={seccion === 'tarifas'} onClick={() => elegir('tarifas')}>Tarifas</button>
      <button type="button" class="opcion" aria-pressed={seccion === 'reglas'} onClick={() => elegir('reglas')}>Reglas</button>
      <button type="button" class="opcion" aria-pressed={seccion === 'productos'} onClick={() => elegir('productos')}>Productos</button>
      <button type="button" class="opcion" aria-pressed={seccion === 'existencias'} onClick={() => elegir('existencias')}>Existencias</button>
      <button type="button" class="opcion" aria-pressed={seccion === 'aviso'} onClick={() => elegir('aviso')}>Aviso</button>
    </div>
    {aviso && <output class="nota nota--exito"><Ico id="check" clase="ico--s" /><p>{aviso}</p>
      <button type="button" class="enlace nota__cerrar" aria-label="Cerrar aviso" onClick={() => setAviso('')}><Ico id="cerrar" clase="ico--xs" /></button></output>}
    {seccion === 'tarifas' && <Tarifas alGuardar={setAviso} />}
    {seccion === 'reglas' && <ReglasHotel alGuardar={setAviso} />}
    {seccion === 'productos' && <Productos alGuardar={setAviso} />}
    {seccion === 'existencias' && <Existencias alGuardar={setAviso} alCambiar={alCambiar} />}
    {seccion === 'aviso' && <AvisoHotel alGuardar={setAviso} />}
  </div>;
}
