// Ajustes → Aviso (TICKET-28): los datos del hotel que aparecen en la política de datos personales. No van en el código,
// que es público. El NIT es el número de documento de quien tiene el negocio registrado: lo escribe la dueña en persona.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi } from '../api.ts';
import { aDatosHotelInput, erroresDatosHotel, textoTelefono, type DatosHotel } from '../aviso.ts';
import { FaltanDatosHotel, PoliticaCompleta } from './AvisoPrivacidad.tsx';
import { Ico } from './Ico.tsx';

type Clave = keyof DatosHotel;
const CAMPOS: Array<{ clave: Clave; etiqueta: string; ayuda: string; modo?: 'numeric' | 'tel' }> = [
  { clave: 'responsable', etiqueta: 'Responsable (a nombre de quién está el negocio)', ayuda: 'Como aparece en la Cámara de Comercio.' },
  { clave: 'nit', etiqueta: 'NIT', ayuda: 'Solo números, puntos y guion.', modo: 'numeric' },
  { clave: 'rnt', etiqueta: 'Registro Nacional de Turismo', ayuda: 'El número del certificado de turismo.', modo: 'numeric' },
  { clave: 'direccion', etiqueta: 'Dirección del hotel', ayuda: 'Por ejemplo: Carrera 1 # 2-34, Florencia.' },
  { clave: 'telefono', etiqueta: 'Teléfono y WhatsApp de la recepción', ayuda: 'A este número escriben los huéspedes que quieran ver o borrar sus datos.', modo: 'tel' },
];

const aTextos = (d: DatosHotel) => ({ ...d, telefono: d.telefono ? textoTelefono(d.telefono) : null });

export function AvisoHotel({ alGuardar }: { alGuardar: (texto: string) => void }) {
  const [datos, setDatos] = useState<DatosHotel | null>(null);
  const [textos, setTextos] = useState<Record<Clave, string | null> | null>(null);
  const [errores, setErrores] = useState<Partial<Record<Clave, string>>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [viendo, setViendo] = useState(false);
  const mostrar = (d: DatosHotel) => { setDatos(d); setTextos(aTextos(d)); };
  useEffect(() => { api.datosHotel().then(mostrar).catch((e: Error) => setError(e.message)); }, []);

  async function guardar(ev: Event) {
    ev.preventDefault();
    if (!textos) return;
    const e = erroresDatosHotel(textos);
    setErrores(e);
    if (Object.keys(e).length) return;
    setEnviando(true); setError('');
    try {
      mostrar(await api.guardarDatosHotel(aDatosHotelInput(textos)));
      alGuardar('Listo: datos del aviso guardados. La política de la entrada ya los muestra.');
    } catch (err) { setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar. Revise la conexión.'); }
    finally { setEnviando(false); }
  }

  if (!datos || !textos) return error ? <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div> : <p><output>Cargando…</output></p>;
  return <form class="tarjeta" onSubmit={(ev) => void guardar(ev)}>
    <div class="tarjeta__cab"><h2><Ico id="info" clase="ico--s" />Datos del hotel en el aviso de privacidad</h2></div>
    <p class="ayuda">Salen en la política completa que recepción le puede mostrar al huésped en la entrada.</p>
    <FaltanDatosHotel datos={datos} />
    <div class="ajustes__rejilla">{CAMPOS.map((c) => <div class="campo" key={c.clave}>
      <label htmlFor={`hotel-${c.clave}`}>{c.etiqueta}</label>
      <input id={`hotel-${c.clave}`} autocomplete="off" inputmode={c.modo} value={textos[c.clave] ?? ''} aria-invalid={!!errores[c.clave]}
        onInput={(e) => setTextos({ ...textos, [c.clave]: (e.target as HTMLInputElement).value })} />
      {errores[c.clave] ? <span class="campo__error">{errores[c.clave]}</span> : <span class="ayuda">{c.ayuda}</span>}
    </div>)}</div>
    {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
    <button type="submit" class="btn btn--primario btn--l btn--bloque" disabled={enviando}><Ico id="check" clase="ico--s" />Guardar datos del aviso</button>
    <button type="button" class="enlace" onClick={() => setViendo(true)}>Ver cómo queda la política</button>
    {viendo && <PoliticaCompleta alCerrar={() => setViendo(false)} />}
  </form>;
}
