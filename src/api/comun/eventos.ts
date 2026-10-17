// Bandeja de salida de eventos (ADR-011): se guardan en la misma transacción que el cambio y luego se publican por SSE.
import type { Bd } from '../../../scripts/lib/bd.ts';

export type Evento = [tipo: string, payload: Record<string, unknown>];

/** Guarda varios eventos en una sola consulta, en el orden dado (el id sirve como Last-Event-ID). */
export async function publicarEventos(bd: Bd, eventos: Evento[], momento: Date): Promise<void> {
  if (eventos.length === 0) return;
  await bd.consultar(
    `INSERT INTO eventos_salida (tipo, payload, ocurrido_en)
     SELECT e.tipo, e.payload::jsonb, $3 FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS e(tipo, payload, n) ORDER BY e.n`,
    [eventos.map(([tipo]) => tipo), eventos.map(([, payload]) => JSON.stringify(payload)), momento],
  );
}
