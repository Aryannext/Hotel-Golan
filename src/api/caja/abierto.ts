// El turno abierto, en un módulo sin más dependencias: lo usan cobros, caja y estadías sin formar un ciclo entre
// `caja/turnos` y `cobros/pagos` (HG-HAL-001 HAL-41).
import type { Bd } from '../../../scripts/lib/bd.ts';
import { ErrorApi } from '../comun/errores.ts';

/** Para cobrar o mover dinero hace falta un turno ABIERTO (RN-09). Lo usan cobros y movimientos de caja. */
export async function turnoAbiertoId(bd: Bd): Promise<string> {
  // FOR SHARE (HAL-16): dentro de la transacción de un cobro, la entrega del turno (FOR UPDATE) espera a que termine y
  // lo cuenta; si la entrega iba primero, el cobro espera, ya no ve el turno abierto y responde SIN_TURNO_ABIERTO.
  const [t] = await bd.consultar<{ id: string }>(`SELECT id FROM turnos WHERE estado = 'ABIERTO' FOR SHARE`);
  if (!t) throw new ErrorApi(409, 'SIN_TURNO_ABIERTO', 'Todavía no hay un turno abierto. Primero hay que recibir el turno.');
  return t.id;
}
