// «Quiénes se quedan hoy» (TICKET-34; FR-31): la lista que se le muestra a la policía cuando pasa de rutina, como hoy el
// talonario (V5-02). Documento completo, sin botones de descargar ni compartir. Abrirla queda en la auditoría.
import { useEffect, useState } from 'preact/hooks';
import { api, type TitularHoy } from '../api.ts';
import { textoSalida, hoyBogota } from '../logica.ts';
import { textoDocumento } from '../presentacion.ts';
import { Panel } from './Panel.tsx';

export function QuienesHoy({ alCerrar }: { alCerrar: () => void }) {
  const [items, setItems] = useState<TitularHoy[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.huespedesHoy().then((r) => setItems(r.items)).catch((e: Error) => setError(e.message)); }, []);

  const hoy = hoyBogota();
  return (
    <Panel titulo="Quiénes se quedan hoy" subtitulo="Para mostrarle a la policía. No se envía ni se descarga." error={error} alCerrar={alCerrar}>
      {items === null && !error && <p><output>Cargando…</output></p>}
      {items?.length === 0 && <p class="ayuda">No hay habitaciones ocupadas.</p>}
      {items && items.length > 0 && <section class="tarjeta">
        {items.map((t) => <div key={t.habitacion_numero} class="fila"><div class="fila__txt">
          <div class="fila__concepto"><b>{t.habitacion_numero}</b> · {t.nombre}</div>
          <div class="fila__detalle">{textoDocumento(t)} · sale {textoSalida(t.salida_prevista_en, hoy)}</div>
        </div></div>)}
      </section>}
    </Panel>
  );
}
