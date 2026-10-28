// Cobrar una deuda de lavandería de un externo (TICKET-24): cuando vuelve y paga lo que quedó debiendo.
import { useState } from 'preact/hooks';
import { api, type MedioPago } from '../api.ts';
import { nuevaClave, pesos } from '../logica.ts';
import type { PedidoLavanderia } from '../lavanderia.ts';
import { Ico } from './Ico.tsx';
import { OpcionesMedio, Panel, useEnvio } from './Panel.tsx';

export function CobrarDeudaLavanderia({ pedido, alCerrar, alCobrar }: { pedido: PedidoLavanderia; alCerrar: () => void; alCobrar: (texto: string) => void }) {
  const [medio, setMedio] = useState<MedioPago>('EFECTIVO');
  const { enviando, error, enviar } = useEnvio();
  // Una clave por envío: un doble toque o un reintento sin señal no lo duplican (Idempotency-Key).
  const [clave] = useState(nuevaClave);
  const valor = pedido.por_cobrar ?? 0;

  const cobrar = () => enviar(async () => {
    await api.cobrarLavanderia(pedido.id, medio, clave);
    alCobrar(`Se cobraron ${pesos(valor)} de la lavandería de ${pedido.cliente_nombre ?? ''}.`);
  });

  return (
    <Panel titulo={`Cobrar deuda · ${pedido.cliente_nombre ?? ''}`} subtitulo={`${pedido.detalle} · entregó ${pedido.sin_pago_autorizado_por ?? ''}`}
      error={error} alCerrar={alCerrar}
      pie={<button type="button" class="btn btn--primario btn--l btn--bloque" disabled={enviando || valor <= 0} onClick={cobrar}>
        <Ico id="efectivo" clase="ico--s" />Cobrar {pesos(valor)}</button>}>
      <div class="saldo saldo--aviso"><div><b>Debe</b><p>Se llevó la ropa sin pagar con la autorización de {pedido.sin_pago_autorizado_por}.</p></div><strong>{pesos(valor)}</strong></div>
      <section class="tarjeta"><div class="tarjeta__cab"><h3>¿Cómo paga?</h3></div>
        <OpcionesMedio medio={medio} alElegir={setMedio} />
      </section>
    </Panel>
  );
}
