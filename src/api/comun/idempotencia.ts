// Idempotency-Key (ADR-008, ADR-011 Inbox): repetir la misma solicitud devuelve la respuesta guardada y no duplica nada.
import type { Bd } from '../../../scripts/lib/bd.ts';
import { ErrorApi } from './errores.ts';

export interface Respuesta<T> { estado: number; cuerpo: T }

const UNICO_VIOLADO = '23505';

async function previa<T>(bd: Bd, clave: string, usuarioId: string, operacion: string): Promise<Respuesta<T> | null> {
  const [f] = await bd.consultar<{ usuario_id: string; operacion: string; estado_http: number; respuesta: T }>(
    'SELECT usuario_id, operacion, estado_http, respuesta FROM solicitudes_idempotentes WHERE clave = $1', [clave]);
  if (!f) return null;
  if (f.usuario_id !== usuarioId || f.operacion !== operacion) {
    throw new ErrorApi(409, 'CONFLICTO', 'Esa clave de solicitud ya se usó para otra operación.');
  }
  return { estado: f.estado_http, cuerpo: f.respuesta };
}

/** Ejecuta `fn` en una transacción; si hay clave, guarda la respuesta en la misma transacción. */
export async function conIdempotencia<T>(
  bd: Bd, clave: string | undefined, usuarioId: string, operacion: string, fn: (tx: Bd) => Promise<Respuesta<T>>,
): Promise<Respuesta<T>> {
  if (clave) {
    const ya = await previa<T>(bd, clave, usuarioId, operacion);
    if (ya) return ya;
  }
  try {
    return await bd.transaccion(async (tx) => {
      const r = await fn(tx);
      if (clave) {
        await tx.consultar(
          'INSERT INTO solicitudes_idempotentes (clave, usuario_id, operacion, estado_http, respuesta) VALUES ($1, $2, $3, $4, $5)',
          [clave, usuarioId, operacion, r.estado, JSON.stringify(r.cuerpo)]);
      }
      return r;
    });
  } catch (error) {
    // Dos envíos simultáneos con la misma clave: el segundo choca con la llave primaria y devuelve lo del primero.
    if (clave && (error as { code?: string }).code === UNICO_VIOLADO) {
      const ya = await previa<T>(bd, clave, usuarioId, operacion);
      if (ya) return ya;
    }
    throw error;
  }
}
