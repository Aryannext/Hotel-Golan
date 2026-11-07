// «Cambiar de habitación» en la ficha (TICKET-26; FR-30, RN-17): elegir la habitación disponible, ver qué pasa con la
// plata (misma regla del servidor: cotización) y hacer el cambio. Al terminar, la ficha se cierra con el resultado.
import { useEffect, useState } from 'preact/hooks';
import { api, type Habitacion } from '../api.ts';
import { hoyBogota, nuevaClave, pesos } from '../logica.ts';
import { disponiblesPara, resumenCambio, type CotizacionCambio } from '../cambio.ts';
import { Ico } from './Ico.tsx';
import { useEnvio } from './Panel.tsx';

export function VistaCambio({ estadiaId, actual, alCambiar }: { estadiaId: string; actual: string; alCambiar: (texto: string) => void }) {
  const [opciones, setOpciones] = useState<Habitacion[]>([]);
  const [destino, setDestino] = useState('');
  const [cot, setCot] = useState<CotizacionCambio | null>(null);
  const { enviando, error, setError, enviar } = useEnvio();
  // Una clave por envío: un doble toque o un reintento sin señal no lo duplican (Idempotency-Key).
  const [clave] = useState(nuevaClave);

  useEffect(() => { api.habitaciones().then((r) => setOpciones(disponiblesPara(r.items, actual))).catch((e: Error) => setError(e.message)); }, [actual]);
  useEffect(() => {
    if (!destino) return;
    let vigente = true;
    setCot(null);
    setError('');
    api.cotizarCambio(estadiaId, destino).then((c) => { if (vigente) setCot(c); }).catch((e: Error) => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [destino]);

  const r = cot && resumenCambio(cot, hoyBogota());
  const cambiar = () => cot && enviar(async () => {
    await api.cambiarHabitacion(estadiaId, destino, clave);
    const plata = r && r.valor ? ` ${r.titulo}: ${pesos(r.valor)}.` : '';
    alCambiar(`La estadía pasó de la ${actual} a la ${destino}. La ${actual} queda por revisar.${plata}`);
  });

  return <>
    <div class="nota nota--info"><Ico id="info" clase="ico--s" /><p>Se cambia antes de las 12 m. Si cambió de opinión a los pocos minutos de entrar, solo se ajusta la diferencia; si ya la usó, se cobra la nueva completa.</p></div>
    {error && <div class="nota nota--alerta" role="alert"><Ico id="alerta" clase="ico--s" /><p>{error}</p></div>}
    <section class="tarjeta"><div class="tarjeta__cab"><h3>¿A qué habitación pasa?</h3></div>
      {opciones.length === 0
        ? <p class="ayuda">No hay habitaciones disponibles.</p>
        : <div class="segmentado segmentado--columna">{opciones.map((h) =>
          <button key={h.numero} type="button" class="opcion" aria-pressed={destino === h.numero} onClick={() => setDestino(h.numero)}>
            {h.numero} · {h.tipo === 'AIRE' ? 'aire' : 'ventilador'}</button>)}</div>}
    </section>
    {r && <div class={`saldo ${r.titulo === 'Se le devuelve' ? 'saldo--alerta' : 'saldo--aviso'}`} aria-live="polite"><div><b>{r.titulo}</b><p>{r.detalle}</p></div><strong>{pesos(r.valor)}</strong></div>}
    <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={!cot || enviando} onClick={cambiar}>
      <Ico id="habitaciones" clase="ico--s" />{destino ? `Pasar a la ${destino}` : 'Elija la habitación'}</button>
  </>;
}
