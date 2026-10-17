// Entregar la ropa lavada (TICKET-23 y TICKET-24; RN-22): se cobra lo que falta del pedido; sin pago, solo con la
// autorización de quien entrega (queda registrada y la deuda sigue: nadie sale debiendo, RN-07).
import { useEffect, useState } from 'preact/hooks';
import { api, type MedioPago } from '../api.ts';
import { pesos } from '../logica.ts';
import { faltaParaEntregar, quienPidio, textoEntrega, type PedidoLavanderia } from '../lavanderia.ts';
import { Ico } from './Ico.tsx';
import { OpcionesMedio, Panel, useEnvio } from './Panel.tsx';

export function EntregarLavanderia({ pedido, alCerrar, alEntregar }: { pedido: PedidoLavanderia; alCerrar: () => void; alEntregar: (texto: string) => void }) {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');
  const [autorizo, setAutorizo] = useState(false);
  const { enviando, error, setError, enviar } = useEnvio();
  const quien = quienPidio(pedido);

  useEffect(() => { if (pedido.estadia_id) api.estadia(pedido.estadia_id).then((e) => setSaldo(e.cuenta.saldo)).catch((e: Error) => setError(e.message)); }, []);

  const falta = faltaParaEntregar(pedido, saldo);
  const huesped = !!pedido.estadia_id;

  const entregar = (sinPago: boolean) => enviar(async () => {
    await api.entregarLavanderia(pedido.id, sinPago ? { sin_pago_autorizado: true } : { cobro: { medio } });
    if (!falta) alEntregar(textoEntrega(quien, 'pagado', 0));
    else alEntregar(textoEntrega(quien, sinPago ? 'sin_pago' : 'cobrado', falta));
  });

  let pie = null;
  if (falta === 0) {
    pie = <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={() => entregar(false)}><Ico id="check" clase="ico--s" />Entregar la ropa</button>;
  } else if (falta && autorizo) {
    pie = <button type="button" class="btn btn--peligro btn--l btn--bloque" disabled={enviando} onClick={() => entregar(true)}><Ico id="alerta" clase="ico--s" />Entregar sin cobrar</button>;
  } else if (falta) {
    pie = <button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando} onClick={() => entregar(false)}><Ico id="efectivo" clase="ico--s" />Cobrar {pesos(falta)} y entregar</button>;
  }
  return (
    <Panel titulo={`Entregar lavandería · ${quien}`} subtitulo={`${pedido.detalle} · ${pesos(pedido.total)}`} error={error} pie={pie} alCerrar={alCerrar}>
      {falta === null && !error && <p><output>Consultando la cuenta…</output></p>}
      {falta === 0 && <div class="saldo saldo--ok"><div><b>Ya está pagado</b>
        <p>{huesped ? 'La cuenta de la habitación no debe este lavado.' : 'Lo pagó por adelantado.'}</p></div><strong>{pesos(0)}</strong></div>}
      {!!falta && <>
        <div class="saldo saldo--aviso"><div><b>Falta por pagar</b><p>Sin pago no se entrega la ropa.</p></div><strong>{pesos(falta)}</strong></div>
        {!autorizo && <section class="tarjeta"><div class="tarjeta__cab"><h3>¿Cómo paga?</h3></div>
          <OpcionesMedio medio={medio} alElegir={setMedio} />
          {medio !== 'EFECTIVO' && <p class="ayuda">Quedará «por confirmar» hasta que la administración revise que llegó.</p>}
        </section>}
        <label class="casilla casilla--aviso">
          <input type="checkbox" checked={autorizo} onChange={(e) => setAutorizo((e.target as HTMLInputElement).checked)} />
          <span>No paga ahora: <b>yo autorizo entregar la ropa sin pago</b> y asumo el riesgo. {huesped ? 'La deuda queda en la cuenta de la habitación.' : 'La deuda queda a su nombre.'}</span></label>
      </>}
    </Panel>
  );
}
