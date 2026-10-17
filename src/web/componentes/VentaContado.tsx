// «Venta de contado» (TICKET-22; FR-26, RN-20): productos de la nevera y las vitrinas a quien no está hospedado.
// El efectivo entra a la caja del turno; una transferencia queda «por confirmar» para la administración.
import { useEffect, useState } from 'preact/hooks';
import { api, type MedioPago } from '../api.ts';
import { nuevaClave, pesos, resumenSeleccion, textoMedio, type Producto } from '../logica.ts';
import { cobroContado } from '../ventas.ts';
import { cuantos } from '../presentacion.ts';
import { SelectorProductos } from './SelectorProductos.tsx';
import { Ico } from './Ico.tsx';
import { OpcionesMedio, Panel, useEnvio } from './Panel.tsx';

/** Solo se vende de contado lo de la nevera y las vitrinas; la lavandería de externos tiene su propio pedido. */
const GRUPOS_DE_CONTADO = new Set(['NEVERA', 'VITRINA_PASABOCAS', 'VITRINA_ASEO']);

export function VentaContado({ alCerrar, alRegistrar }: { alCerrar: () => void; alRegistrar: (texto: string) => void }) {
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');
  const [recibido, setRecibido] = useState('');
  const [clave] = useState(nuevaClave);
  const { enviando, error, setError, enviar } = useEnvio();

  useEffect(() => { api.productos().then((r) => setCatalogo(r.items.filter((p) => GRUPOS_DE_CONTADO.has(p.grupo)))).catch((e: Error) => setError(e.message)); }, []);

  const sumar = (pid: string, paso: number) => setCantidades({ ...cantidades, [pid]: Math.max(0, Math.min(50, (cantidades[pid] ?? 0) + paso)) });
  const sel = resumenSeleccion(catalogo, cantidades);
  const efectivo = medio === 'EFECTIVO';
  const cobro = cobroContado(sel.total, recibido);
  const puede = sel.items.length > 0 && (!efectivo || cobro.puede);

  const registrar = () => puede && enviar(async () => {
    await api.venderContado(sel.items.map((x) => ({ producto_id: x.producto.id, cantidad: x.cantidad })), medio, clave);
    const como = efectivo ? 'en efectivo: entra a la caja' : `por ${textoMedio(medio)}: queda por confirmar`;
    alRegistrar(`Venta de contado de ${pesos(sel.total)} ${como}.`);
  });

  const textoBoton = sel.items.length ? `Registrar venta · ${pesos(sel.total)}` : 'Elija productos';
  const pie = <>
    <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={!puede || enviando} onClick={registrar}>
      <Ico id="efectivo" clase="ico--s" />{textoBoton}</button>
    {sel.items.length > 0 && <p class="ayuda" style="text-align:center;margin:8px 0 0">{cuantos(sel.items.length, 'producto', 'productos')}</p>}
  </>;
  return (
    <Panel titulo="Venta de contado" subtitulo="Para quien no está hospedado. A un huésped se le puede cargar a la habitación." error={error} pie={pie} alCerrar={alCerrar}>
      <SelectorProductos catalogo={catalogo} cantidades={cantidades} sel={sel} sumar={sumar} />
      {sel.items.length > 0 && <section class="tarjeta"><div class="tarjeta__cab"><h3>¿Cómo paga?</h3></div>
        <OpcionesMedio medio={medio} alElegir={setMedio} />
        {efectivo
          ? <>
            <div class="campo"><label htmlFor="venta-recibido">Valor recibido</label>
              <input id="venta-recibido" inputmode="numeric" autocomplete="off" placeholder={String(sel.total)} value={recibido}
                onInput={(e) => setRecibido((e.target as HTMLInputElement).value)} /></div>
            <div class={`saldo ${cobro.puede ? 'saldo--ok' : 'saldo--alerta'}`}><div>
              <b>{cobro.titulo}</b>
              <p>{cobro.puede ? `Entran ${pesos(sel.total)} a la caja.` : 'De contado se paga completo: no hay abonos.'}</p>
            </div><strong>{pesos(cobro.valor)}</strong></div>
          </>
          : <p class="ayuda">Quedará «por confirmar» hasta que la administración revise que llegó.</p>}
      </section>}
    </Panel>
  );
}
