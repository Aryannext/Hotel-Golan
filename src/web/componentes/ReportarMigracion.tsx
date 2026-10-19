// «Reportar a Migración» (TICKET-37; FR-33, RN-24): un huésped extranjero se reporta a Migración Colombia al llegar y al
// salir, en la página del SIRE. El sistema no se conecta a esa página: muestra los datos para llenarla (la consulta queda
// en la auditoría) y guarda quién marcó «Ya lo reporté».
import { useEffect, useState } from 'preact/hooks';
import { api, type DatosMigracion } from '../api.ts';
import type { TipoReporte } from '../avisos.ts';
import { diaRelativo, horaBogota, hoyBogota } from '../logica.ts';
import { textoDocumento } from '../presentacion.ts';
import { Ico } from './Ico.tsx';
import { Panel, useEnvio } from './Panel.tsx';

const cuando = (iso: string, hoy: string) => `${diaRelativo(iso, hoy)}, ${horaBogota(iso)}`;

export function ReportarMigracion({ estadiaId, tipo, alCerrar, alReportar }: {
  estadiaId: string; tipo: TipoReporte; alCerrar: () => void; alReportar: () => void;
}) {
  const [datos, setDatos] = useState<DatosMigracion | null>(null);
  const { enviando, error, setError, enviar } = useEnvio();
  useEffect(() => { api.migracionDatos(estadiaId).then(setDatos).catch((e: Error) => setError(e.message)); }, [estadiaId]);

  const que = tipo === 'LLEGADA' ? 'la llegada' : 'la salida';
  const hoy = hoyBogota();
  const pie = <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando || !datos}
    onClick={() => void enviar(async () => { await api.reportarMigracion(estadiaId, tipo); alReportar(); })}>
    <Ico id="check" clase="ico--s" />Ya lo reporté</button>;

  return (
    <Panel titulo={`Reportar a Migración ${que}`} subtitulo={datos ? `Habitación ${datos.habitacion_numero}` : undefined} error={error} pie={pie} alCerrar={alCerrar}>
      <div class="nota nota--info"><Ico id="info" clase="ico--s" />
        <p>Los huéspedes extranjeros se reportan a Migración Colombia al llegar y al salir. Entre a la página de Migración (SIRE), reporte {que} con estos datos y después toque «Ya lo reporté».</p></div>
      {datos === null && !error && <p><output>Cargando…</output></p>}
      {datos && <section class="tarjeta"><dl class="kv">
        <dt>Huésped</dt><dd>{datos.nombre ?? 'Datos ya borrados'}</dd>
        <dt>Documento</dt><dd>{textoDocumento(datos)}</dd>
        <dt>Nacionalidad</dt><dd>{datos.nacionalidad ?? '—'}</dd>
        <dt>Llegó</dt><dd>{cuando(datos.entrada_en, hoy)}</dd>
        {datos.salida_en && <><dt>Salió</dt><dd>{cuando(datos.salida_en, hoy)}</dd></>}
      </dl></section>}
    </Panel>
  );
}
