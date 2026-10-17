// Equipo (TICKET-14, FR-18 y FR-20): la administración agrega personas, cambia un PIN, desbloquea, desactiva
// y ve quién hizo cada cosa. El PIN nunca se muestra ni se guarda en la pantalla después de enviarlo.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi } from '../api.ts';
import { horaBogota } from '../logica.ts';
import { fechaReporte } from '../reportes.ts';
import { erroresUsuarioNuevo, estadoUsuario, sugerirUsuario, textoActividad, type FormUsuario, type RegistroActividad, type UsuarioAdmin } from '../equipo.ts';
import { Ico } from './Ico.tsx';

const mensaje = (e: unknown) => e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema. Intente de nuevo.';
const textoRol = (rol: UsuarioAdmin['rol']) => rol === 'ADMINISTRACION' ? 'Administración' : 'Recepción';
const FILTROS: Array<[string, string]> = [
  ['', 'Todo'], ['pagos', 'Cobros y transferencias'], ['movimientos_caja', 'Salidas de dinero'], ['estadias', 'Entradas y salidas de huéspedes'],
  ['turnos', 'Turnos'], ['habitaciones', 'Habitaciones'], ['usuarios', 'Personal'], ['sesiones', 'Entradas al sistema'],
];
const VACIO: FormUsuario = { nombre: '', usuario: '', pin: '', confirmar: '' };

function CampoPin({ id, etiqueta, valor, error, alCambiar }: { id: string; etiqueta: string; valor: string; error?: string; alCambiar: (v: string) => void }) {
  return <div class="campo"><label htmlFor={id}>{etiqueta}</label>
    <input id={id} class="pin" type="password" inputmode="numeric" maxLength={6} autocomplete="new-password" value={valor}
      aria-invalid={!!error} onInput={(e) => alCambiar((e.target as HTMLInputElement).value.replace(/\D/g, ''))} />
    {error && <span class="campo__error">{error}</span>}</div>;
}

function NuevoUsuario({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: (texto: string) => void }) {
  const [f, setF] = useState(VACIO);
  const [rol, setRol] = useState<UsuarioAdmin['rol']>('RECEPCION');
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const [errores, setErrores] = useState<Partial<Record<keyof FormUsuario, string>>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function crear(ev: Event) {
    ev.preventDefault();
    const e = erroresUsuarioNuevo(f);
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true); setError('');
    try {
      const u = await api.crearUsuario({ nombre: f.nombre.trim(), usuario: f.usuario, rol, pin: f.pin });
      alCrear(`Listo: ${u.nombre} ya puede entrar con el usuario «${u.usuario}» y el PIN que le asignó.`);
    } catch (err) { setError(mensaje(err)); setEnviando(false); }
  }

  return <form class="tarjeta" onSubmit={(ev) => void crear(ev)} aria-labelledby="nuevo-titulo">
    <div class="tarjeta__cab"><h2 id="nuevo-titulo"><Ico id="nuevo-huesped" clase="ico--s" />Agregar persona</h2>
      <button type="button" class="btn btn--fantasma btn--mini" onClick={alCerrar}>Cancelar</button></div>
    <div class="campo"><label htmlFor="nu-nombre">Nombre</label>
      <input id="nu-nombre" autocomplete="off" maxLength={80} value={f.nombre} aria-invalid={!!errores.nombre}
        onInput={(e) => { const nombre = (e.target as HTMLInputElement).value; setF({ ...f, nombre, usuario: usuarioEditado ? f.usuario : sugerirUsuario(nombre) }); }} />
      {errores.nombre && <span class="campo__error">{errores.nombre}</span>}</div>
    <div class="campo"><label htmlFor="nu-usuario">Usuario para entrar</label>
      <input id="nu-usuario" autocomplete="off" autocapitalize="none" spellcheck={false} maxLength={40} value={f.usuario} aria-invalid={!!errores.usuario}
        onInput={(e) => { setUsuarioEditado(true); setF({ ...f, usuario: (e.target as HTMLInputElement).value.trim().toLowerCase() }); }} />
      {errores.usuario ? <span class="campo__error">{errores.usuario}</span> : <span class="ayuda">Se sugiere solo a partir del nombre; puede cambiarlo.</span>}</div>
    <div class="campo"><span>¿Qué hace?</span>
      <div class="segmentado">
        <button type="button" class="opcion" aria-pressed={rol === 'RECEPCION'} onClick={() => setRol('RECEPCION')}>Recepción</button>
        <button type="button" class="opcion" aria-pressed={rol === 'ADMINISTRACION'} onClick={() => setRol('ADMINISTRACION')}>Administración</button>
      </div>
      {rol === 'ADMINISTRACION' && <span class="ayuda">Podrá confirmar transferencias, anular, ver el historial y manejar el personal.</span>}</div>
    <div class="doble doble--igual">
      <CampoPin id="nu-pin" etiqueta="PIN de 6 números" valor={f.pin} error={errores.pin} alCambiar={(pin) => setF({ ...f, pin })} />
      <CampoPin id="nu-confirmar" etiqueta="Repita el PIN" valor={f.confirmar} error={errores.confirmar} alCambiar={(confirmar) => setF({ ...f, confirmar })} />
    </div>
    <p class="ayuda">Entréguele el PIN a la persona en privado. El sistema lo guarda cifrado: nadie puede verlo después.</p>
    {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
    <button type="submit" class="btn btn--primario btn--l btn--bloque" disabled={enviando}><Ico id="check" clase="ico--s" />Agregar</button>
  </form>;
}

function Persona({ u, soyYo, alCambiar }: { u: UsuarioAdmin; soyYo: boolean; alCambiar: (texto: string) => void }) {
  const [modo, setModo] = useState<'' | 'pin' | 'desactivar'>('');
  const [pin, setPin] = useState({ pin: '', confirmar: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const estado = estadoUsuario(u);

  async function cambiar(cuerpo: { activo?: boolean; pin?: string; desbloquear?: boolean }, texto: string) {
    setEnviando(true); setError('');
    try { await api.actualizarUsuario(u.id, cuerpo); setModo(''); setPin({ pin: '', confirmar: '' }); alCambiar(texto); }
    catch (err) { setError(mensaje(err)); }
    finally { setEnviando(false); }
  }

  function guardarPin(ev: Event) {
    ev.preventDefault();
    if (!/^\d{6}$/.test(pin.pin)) { setError('El PIN debe tener 6 números.'); return; }
    if (pin.pin !== pin.confirmar) { setError('Los dos PIN no coinciden.'); return; }
    void cambiar({ pin: pin.pin }, `PIN de ${u.nombre} cambiado. Si tenía una sesión abierta, tendrá que entrar de nuevo con el PIN nuevo.`);
  }

  return <section class={`tarjeta persona${u.activo ? '' : ' persona--inactiva'}`}>
    <div class="tarjeta__cab">
      <div class="persona__txt"><h3>{u.nombre}{soyYo && <span class="ayuda"> (usted)</span>}</h3>
        <p class="ayuda">{u.usuario} · {textoRol(u.rol)}</p></div>
      <span class={`pill pill--${estado.tono}`}>{estado.texto}</span>
    </div>
    {modo === '' && <div class="persona__acciones">
      {u.activo && u.bloqueado_hasta && <button type="button" class="btn btn--exito btn--mini" disabled={enviando}
        onClick={() => void cambiar({ desbloquear: true }, `${u.nombre} ya puede volver a entrar.`)}><Ico id="check" clase="ico--xs" />Desbloquear</button>}
      {u.activo && <button type="button" class="btn btn--secundario btn--mini" onClick={() => { setError(''); setModo('pin'); }}>Cambiar PIN</button>}
      {u.activo && !soyYo && <button type="button" class="btn btn--peligro btn--mini" onClick={() => { setError(''); setModo('desactivar'); }}>Desactivar</button>}
      {!u.activo && <button type="button" class="btn btn--secundario btn--mini" disabled={enviando}
        onClick={() => void cambiar({ activo: true }, `${u.nombre} está activo otra vez y puede entrar con su PIN.`)}>Reactivar</button>}
    </div>}
    {modo === 'pin' && <form class="persona__form" onSubmit={guardarPin}>
      <div class="doble doble--igual">
        <CampoPin id={`pin-${u.id}`} etiqueta="PIN nuevo" valor={pin.pin} alCambiar={(v) => setPin({ ...pin, pin: v })} />
        <CampoPin id={`pin2-${u.id}`} etiqueta="Repita el PIN" valor={pin.confirmar} alCambiar={(v) => setPin({ ...pin, confirmar: v })} />
      </div>
      <div class="persona__acciones">
        <button type="submit" class="btn btn--primario btn--mini" disabled={enviando}>Guardar PIN</button>
        <button type="button" class="btn btn--fantasma btn--mini" onClick={() => setModo('')}>Cancelar</button>
      </div>
    </form>}
    {modo === 'desactivar' && <div class="persona__form">
      <div class="nota nota--alerta"><Ico id="alerta" clase="ico--s" /><p>{u.nombre} no podrá entrar y se cerrará su sesión si la tiene abierta. Lo que registró se conserva. Puede reactivarlo cuando quiera.</p></div>
      <div class="persona__acciones">
        <button type="button" class="btn btn--peligro btn--mini" disabled={enviando}
          onClick={() => void cambiar({ activo: false }, `${u.nombre} quedó desactivado.`)}>Sí, desactivar</button>
        <button type="button" class="btn btn--fantasma btn--mini" onClick={() => setModo('')}>Cancelar</button>
      </div>
    </div>}
    {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
  </section>;
}

function Actividad({ recarga, nombres }: { recarga: number; nombres: Record<string, string> }) {
  const [entidad, setEntidad] = useState('');
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState<{ items: RegistroActividad[]; total: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let vigente = true;
    setError('');
    api.auditoria(pagina * 20, entidad).then((r) => { if (vigente) setDatos(r); })
      .catch((e) => { if (vigente) setError(mensaje(e)); });
    return () => { vigente = false; };
  }, [pagina, entidad, recarga]);

  return <section class="tarjeta">
    <div class="tarjeta__cab"><h2><Ico id="reloj" clase="ico--s" />Quién hizo qué</h2></div>
    <div class="campo"><label htmlFor="act-filtro">Mostrar</label>
      <select id="act-filtro" value={entidad} onChange={(e) => { setEntidad((e.target as HTMLSelectElement).value); setPagina(0); }}>
        {FILTROS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
    {error && <p class="nota nota--alerta" role="alert">{error}</p>}
    {datos?.items.length === 0 && <p class="vacio">No hay actividad para mostrar.</p>}
    {datos?.items.map((r) => <div class="mov" key={r.id}>
      <div class="mov__txt"><div class="mov__titulo">{textoActividad(r, nombres)}</div>
        <div class="mov__detalle">{r.usuario ?? 'El sistema'} · {fechaReporte(r.ocurrido_en)} · {horaBogota(r.ocurrido_en)}</div></div>
    </div>)}
    {datos && datos.total > 20 && <nav class="historial__cab" aria-label="Páginas de la actividad">
      <button type="button" class="btn btn--secundario" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Más recientes</button>
      <span>{pagina * 20 + 1}–{pagina * 20 + datos.items.length} de {datos.total}</span>
      <button type="button" class="btn btn--secundario" disabled={(pagina + 1) * 20 >= datos.total} onClick={() => setPagina(pagina + 1)}>Anteriores</button>
    </nav>}
    <p class="ayuda">Aquí no aparecen nombres ni documentos de huéspedes: solo quién hizo la acción, cuándo y sobre qué.</p>
  </section>;
}

export function Equipo({ recarga, yo }: { recarga: number; yo: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[] | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [propia, setPropia] = useState(0);

  useEffect(() => {
    api.usuarios().then((r) => { setUsuarios(r.items); setError(''); }).catch((e) => setError(mensaje(e)));
  }, [recarga, propia]);

  const listo = (texto: string) => { setAviso(texto); setAgregando(false); setPropia((n) => n + 1); };
  const nombres = Object.fromEntries((usuarios ?? []).map((u) => [u.id, u.usuario]));

  return <div class="historial">
    <div class="titulo-vista"><div><h1>Equipo</h1><p>Quién puede entrar al sistema y qué hizo cada uno</p></div>
      {!agregando && <button type="button" class="btn btn--primario" onClick={() => { setAviso(''); setAgregando(true); }}><Ico id="mas" clase="ico--s" />Agregar persona</button>}
    </div>
    {aviso && <output class="nota nota--exito"><Ico id="check" clase="ico--s" /><p>{aviso}</p>
      <button type="button" class="enlace nota__cerrar" aria-label="Cerrar aviso" onClick={() => setAviso('')}><Ico id="cerrar" clase="ico--xs" /></button></output>}
    {agregando && <NuevoUsuario alCerrar={() => setAgregando(false)} alCrear={listo} />}
    {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
    {usuarios && <div class="personas">{usuarios.map((u) => <Persona key={u.id} u={u} soyYo={u.id === yo} alCambiar={listo} />)}</div>}
    <Actividad recarga={recarga + propia} nombres={nombres} />
  </div>;
}
