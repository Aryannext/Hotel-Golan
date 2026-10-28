// Solicitudes de factura (TICKET-25; FR-28, RN-23). En la ficha, recepción anota el RUT o NIT y el correo o el celular.
// En «Por confirmar», la administración las ve y las avanza: pasada al contador y, cuando se la envía al huésped, entregada.
// El sistema no hace facturas: solo lleva el seguimiento.
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { diaRelativo, horaBogota, hoyBogota, nuevaClave } from '../logica.ts';
import {
  aSolicitudInput, erroresFactura, estadoFactura, FACTURA_VACIA, siguientePaso, textoPrevista, type FormFactura, type SolicitudFactura,
} from '../facturas.ts';
import { CampoTexto } from './Entrada.tsx';
import { Ico } from './Ico.tsx';
import { useEnvio } from './Panel.tsx';

const cuando = (iso: string) => `${diaRelativo(iso, hoyBogota())} a las ${horaBogota(iso)}`;

function Estado({ s }: { s: SolicitudFactura }) {
  const [clase, texto] = estadoFactura(s.estado);
  return <span class={`pill ${clase}`}>{texto}</span>;
}

/** Vista de la ficha: lo ya anotado para esta estadía y el formulario para anotar una solicitud nueva. */
export function VistaFactura({ estadiaId }: { estadiaId: string }) {
  const [lista, setLista] = useState<SolicitudFactura[]>([]);
  const [form, setForm] = useState<FormFactura>(FACTURA_VACIA);
  const [verErrores, setVerErrores] = useState(false);
  const [listo, setListo] = useState('');
  const { enviando, error, setError, enviar } = useEnvio();
  // Una clave por solicitud: un doble toque o un reintento sin señal no la duplican (Idempotency-Key).
  const [clave, setClave] = useState(nuevaClave);

  useEffect(() => { api.solicitudesFacturaDeEstadia(estadiaId).then((r) => setLista(r.items)).catch((e: Error) => setError(e.message)); }, [estadiaId]);

  const errores = verErrores ? erroresFactura(form) : {};
  const campo = (k: keyof FormFactura) => (v: string) => { setForm({ ...form, [k]: v }); setListo(''); };

  function anotar() {
    setVerErrores(true);
    if (Object.keys(erroresFactura(form)).length) return;
    void enviar(async () => {
      const s = await api.solicitarFactura(estadiaId, aSolicitudInput(form), clave);
      setClave(nuevaClave());
      setLista([...lista, s]);
      setForm(FACTURA_VACIA);
      setVerErrores(false);
      setListo(`Solicitud anotada. La administración se la pasa al contador; estará lista ${textoPrevista(s.fecha_prevista, s.fecha_prevista_hasta)}.`);
    });
  }

  return <>
    <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>El sistema no hace la factura: anote los datos y la administración se los pasa al contador. Cuando él la devuelva, la administración o recepción se la envía al huésped por WhatsApp o correo.</p></div>
    {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
    {listo && <div class="nota" role="status"><Ico id="check" clase="ico--s" /><p>{listo}</p></div>}
    {lista.length > 0 && <section class="tarjeta"><div class="tarjeta__cab"><h3>Ya pedidas</h3></div>
      {lista.map((s) => <div key={s.id} class="fila"><div class="fila__txt"><div class="fila__concepto">RUT o NIT {s.documento ?? '(borrado)'}</div>
        <div class="fila__detalle">Lista {textoPrevista(s.fecha_prevista, s.fecha_prevista_hasta)} · anotó {s.registrada_por}</div></div><Estado s={s} /></div>)}
    </section>}
    <section class="tarjeta"><div class="tarjeta__cab"><h3>Datos para la factura</h3></div>
      <CampoTexto id="factura-documento" etiqueta="RUT o NIT" req valor={form.documento} error={errores.documento} alEscribir={campo('documento')} placeholder="900123456-7" />
      <CampoTexto id="factura-correo" etiqueta="Correo" valor={form.correo} error={errores.correo} alEscribir={campo('correo')} inputmode="email" />
      <CampoTexto id="factura-telefono" etiqueta="Celular" valor={form.telefono} error={errores.telefono} alEscribir={campo('telefono')} inputmode="tel" />
      <p class="ayuda">Basta el correo o el celular: por ahí se le envía. El contador tarda de 1 a 3 días hábiles (no trabaja sábados, domingos ni festivos).</p>
      <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={anotar}><Ico id="check" clase="ico--s" />Anotar solicitud</button>
    </section>
  </>;
}

/** Lista de la administración: lo que falta pasar al contador y lo que está con él. */
export function SolicitudesFactura({ recarga }: { recarga: number }) {
  const [lista, setLista] = useState<SolicitudFactura[]>([]);
  const { enviando, error, setError, enviar } = useEnvio();
  const cargar = () => api.solicitudesFacturaAbiertas().then((r) => setLista(r.items)).catch((e: Error) => setError(e.message));

  useEffect(() => { void cargar(); }, [recarga]);

  const avanzar = (s: SolicitudFactura) => {
    const paso = siguientePaso(s.estado);
    if (paso) void enviar(async () => { await api.avanzarSolicitudFactura(s.id, paso.estado); await cargar(); });
  };

  return <section class="caja-simple" style="margin-top:32px" aria-labelledby="facturas-titulo">
    <div class="titulo-vista"><div><h1 id="facturas-titulo">Solicitudes de factura</h1>
      <p>Páselas al contador con el RUT o NIT. Cuando él se la mande, envíela al huésped por WhatsApp o correo y márquela como entregada.</p></div></div>
    {error && <div class="nota" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
    {lista.length === 0
      ? <section class="tarjeta"><p class="vacio"><Ico id="check" clase="ico--s" /> No hay facturas pendientes.</p></section>
      : lista.map((s) => {
        const paso = siguientePaso(s.estado);
        return <section class="tarjeta confirmar" key={s.id}>
          <div class="confirmar__cab"><strong>Habitación {s.habitacion_numero}</strong><Estado s={s} /></div>
          <p class="ayuda"><b>RUT o NIT {s.documento}</b>{s.correo && <> · {s.correo}</>}{s.telefono && <> · {s.telefono.replace(/^\+57/, '')}</>}</p>
          <p class="ayuda">Lista {textoPrevista(s.fecha_prevista, s.fecha_prevista_hasta)} · anotó {s.registrada_por} {cuando(s.registrada_en)}</p>
          {paso && <div class="confirmar__botones">
            <button type="button" class="btn btn--primario btn--l" disabled={enviando} onClick={() => avanzar(s)}><Ico id="check" clase="ico--s" />{paso.texto}</button>
          </div>}
        </section>;
      })}
  </section>;
}
