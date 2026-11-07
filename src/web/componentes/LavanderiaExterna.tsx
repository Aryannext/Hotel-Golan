// Lavandería para externos (TICKET-24; FR-27, RN-22): se anota solo el nombre; paga de una vez o al reclamar (T4-4).
import { useEffect, useState } from 'preact/hooks';
import { api, type MedioPago } from '../api.ts';
import { nuevaClave, pesos, resumenSeleccion, textoMedio, type Producto } from '../logica.ts';
import { SelectorProductos } from './SelectorProductos.tsx';
import { Ico } from './Ico.tsx';
import { Panel, useEnvio } from './Panel.tsx';

type Cuando = 'RECLAMAR' | MedioPago;
const OPCIONES: Array<[Cuando, string]> = [['RECLAMAR', 'Paga al reclamar'], ['EFECTIVO', 'Ya, en efectivo'], ['NEQUI', `Ya, por ${textoMedio('NEQUI')}`], ['BANCOLOMBIA', `Ya, por ${textoMedio('BANCOLOMBIA')}`]];

export function LavanderiaExterna({ alCerrar, alRegistrar }: { alCerrar: () => void; alRegistrar: (texto: string) => void }) {
  const [prendas, setPrendas] = useState<Producto[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [nombre, setNombre] = useState('');
  const [cuando, setCuando] = useState<Cuando>('RECLAMAR');
  const [verError, setVerError] = useState(false);
  const { enviando, error, setError, enviar } = useEnvio();
  // Una clave por envío: un doble toque o un reintento sin señal no lo duplican (Idempotency-Key).
  const [clave] = useState(nuevaClave);

  useEffect(() => { api.productos().then((r) => setPrendas(r.items.filter((p) => p.grupo === 'LAVANDERIA'))).catch((e: Error) => setError(e.message)); }, []);

  const sumar = (pid: string, paso: number) => setCantidades({ ...cantidades, [pid]: Math.max(0, Math.min(50, (cantidades[pid] ?? 0) + paso)) });
  const sel = resumenSeleccion(prendas, cantidades);
  const nombreValido = nombre.trim().length >= 2;

  function registrar() {
    setVerError(true);
    if (!nombreValido || !sel.items.length) return;
    void enviar(async () => {
      const items = sel.items.map((x) => ({ producto_id: x.producto.id, cantidad: x.cantidad }));
      await api.lavanderiaExterna(nombre.trim(), items, cuando === 'RECLAMAR' ? undefined : { medio: cuando }, clave);
      const pago = cuando === 'RECLAMAR' ? 'Paga al reclamar.' : `Pagó ${pesos(sel.total)} por adelantado.`;
      alRegistrar(`Lavandería de ${nombre.trim()} recibida (${pesos(sel.total)}). ${pago}`);
    });
  }

  return (
    <Panel titulo="Lavandería de afuera" subtitulo="Para alguien que no está hospedado. Solo se anota el nombre." error={error} alCerrar={alCerrar}
      pie={<button type="button" class="btn btn--primario btn--l btn--bloque" disabled={!sel.items.length || enviando} onClick={registrar}>
        <Ico id="lavanderia" clase="ico--s" />{sel.items.length ? `Recibir ropa · ${pesos(sel.total)}` : 'Elija las prendas'}</button>}>
      <div class="campo"><label htmlFor="externo-nombre">Nombre de quien trae la ropa</label>
        <input id="externo-nombre" autocomplete="off" maxLength={120} value={nombre} aria-invalid={verError && !nombreValido}
          onInput={(e) => setNombre((e.target as HTMLInputElement).value)} />
        {verError && !nombreValido && <span class="campo__error">Escriba el nombre (mínimo 2 letras).</span>}</div>
      <SelectorProductos catalogo={prendas} cantidades={cantidades} sel={sel} sumar={sumar} />
      {sel.items.length > 0 && <section class="tarjeta"><div class="tarjeta__cab"><h3>¿Cuándo paga?</h3></div>
        <div class="segmentado segmentado--columna">{OPCIONES.map(([v, t]) =>
          <button key={v} type="button" class="opcion" aria-pressed={cuando === v} onClick={() => setCuando(v)}>{t}</button>)}</div>
        <p class="ayuda">{cuando === 'RECLAMAR' ? 'Sin pago no se le entrega la ropa, salvo que usted lo autorice.' : 'Una transferencia queda «por confirmar» hasta que la administración revise.'}</p>
      </section>}
    </Panel>
  );
}
