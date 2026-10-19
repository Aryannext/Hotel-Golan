// Aviso de privacidad en la entrada (TICKET-28; FR-05, RN-16, ADR-006): el texto corto que recepción le dice al huésped
// y la política completa, con los datos del hotel que la administración escribe en Ajustes.
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.ts';
import { TEXTO_CORTO, faltantesHotel, politica, type DatosHotel } from '../aviso.ts';
import { Ico } from './Ico.tsx';
import { Panel } from './Panel.tsx';

export function AvisoCorto({ alVerCompleto }: { alVerCompleto: () => void }) {
  return <div class="aviso-privacidad">
    <p class="aviso-privacidad__titulo"><Ico id="info" clase="ico--s" />Dígale al huésped:</p>
    <blockquote>{TEXTO_CORTO.map((p) => <p key={p}>{p}</p>)}</blockquote>
    <button type="button" class="enlace" onClick={alVerCompleto}>Ver la política completa</button>
  </div>;
}

/** Aviso para la administración cuando faltan datos del hotel. */
export function FaltanDatosHotel({ datos }: { datos: DatosHotel }) {
  const faltan = faltantesHotel(datos);
  if (faltan.length === 0) return null;
  return <div class="nota nota--alerta" role="status"><Ico id="alerta" clase="ico--s" />
    <p>Faltan los datos del hotel en el aviso: {faltan.join(', ')}. La administración los completa en Ajustes → Aviso.</p></div>;
}

export function PoliticaCompleta({ alCerrar }: { alCerrar: () => void }) {
  const [datos, setDatos] = useState<DatosHotel | null>(null);
  const [retencion, setRetencion] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.datosHotel().then(setDatos).catch((e: Error) => setError(e.message));
    api.reglas().then((r) => setRetencion(r.retencion_datos_dias)).catch(() => undefined);
  }, []);

  return (
    <Panel titulo="Política de datos personales" subtitulo="Para leerla o mostrársela al huésped que la pida." error={error} alCerrar={alCerrar}>
      {datos === null && !error && <p><output>Cargando…</output></p>}
      {datos && <>
        <FaltanDatosHotel datos={datos} />
        <section class="tarjeta politica">{politica(datos, retencion).map((s) => <div key={s.titulo}>
          <h3>{s.titulo}</h3>{s.parrafos.map((p) => <p key={p}>{p}</p>)}
        </div>)}</section>
      </>}
    </Panel>
  );
}
