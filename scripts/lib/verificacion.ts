// Simulador de la confirmación de transferencias (opción B, RN-12), con los patrones Inbox y Outbox (ADR-011).
// - Inbox: la clave de idempotencia guarda el resultado; si se repite, no se aplica dos veces.
// - Outbox: el evento SSE se escribe en la misma transacción que el cambio del pago.
// La API de la Fase 3 reutilizará esta misma regla.
import type { Bd } from './bd.ts';

export type ResultadoVerificacion = 'LLEGO' | 'NO_LLEGO';

export interface PagoVerificado {
  id: string;
  estado: 'VERIFICADO' | 'RECHAZADO';
  valor: number;
  repetida: boolean;
}

export async function verificarPago(
  bd: Bd,
  entrada: { pagoId: string; resultado: ResultadoVerificacion; usuarioId: string; clave: string },
): Promise<PagoVerificado> {
  return bd.transaccion(async (tx) => {
    const [previa] = await tx.consultar<{ respuesta: Omit<PagoVerificado, 'repetida'> }>(
      'SELECT respuesta FROM solicitudes_idempotentes WHERE clave = $1', [entrada.clave]);
    if (previa) return { ...previa.respuesta, repetida: true };

    const [pago] = await tx.consultar<{ id: string; estado: string; valor: number; habitacion: string; anulado_en: string | null }>(
      `SELECT p.id, p.estado, p.valor, e.habitacion_numero AS habitacion, p.anulado_en
         FROM pagos p JOIN estadias e ON e.id = p.estadia_id
        WHERE p.id = $1 FOR UPDATE OF p`, [entrada.pagoId]);
    if (!pago) throw new Error('NO_ENCONTRADO: el pago no existe');
    if (pago.estado !== 'POR_VERIFICAR' || pago.anulado_en) throw new Error(`CONFLICTO: el pago está ${pago.estado}`);

    const estado = entrada.resultado === 'LLEGO' ? 'VERIFICADO' : 'RECHAZADO';
    await tx.consultar(
      'UPDATE pagos SET estado = $2, verificado_por = $3, verificado_en = now() WHERE id = $1',
      [pago.id, estado, entrada.usuarioId]);
    await tx.consultar(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle) VALUES ($1, 'VERIFICAR', 'pagos', $2, $3)`,
      [entrada.usuarioId, pago.id, JSON.stringify({ resultado: entrada.resultado })]);
    await tx.consultar(
      'INSERT INTO eventos_salida (tipo, payload) VALUES ($1, $2)',
      [estado === 'VERIFICADO' ? 'pago.verificado' : 'pago.rechazado',
        JSON.stringify({ entidad_id: pago.id, habitacion_numero: pago.habitacion, valor: pago.valor })]);

    const respuesta = { id: pago.id, estado, valor: pago.valor } as const;
    await tx.consultar(
      `INSERT INTO solicitudes_idempotentes (clave, usuario_id, operacion, estado_http, respuesta) VALUES ($1, $2, 'verificarPago', 200, $3)`,
      [entrada.clave, entrada.usuarioId, JSON.stringify(respuesta)]);
    return { ...respuesta, repetida: false };
  });
}
