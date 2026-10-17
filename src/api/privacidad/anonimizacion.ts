// Anonimización (FR-21, RN-16, ADR-006): borra nombre, documento y teléfono de los huéspedes cuya última estadía
// terminó hace más de `retencion_datos_dias` (90 [P/V]). Importes, cargos, pagos y autorización se conservan.
// Es idempotente: un huésped ya anonimizado no se vuelve a tocar ni a auditar.
import type { Bd } from '../../../scripts/lib/bd.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { regla } from '../estadias/cotizaciones.ts';

export async function anonimizarVencidos(bd: Bd, ahora: Date): Promise<{ anonimizados: number }> {
  return bd.transaccion(async (tx) => {
    const dias = await regla(tx, 'retencion_datos_dias');
    // Un huésped con una estadía activa o terminada hace menos del plazo conserva sus datos.
    const filas = await tx.consultar<{ id: string }>(
      `UPDATE huespedes h
          SET nombre = NULL, tipo_documento = NULL, numero_documento = NULL, telefono = NULL, anonimizado_en = $1
        WHERE h.anonimizado_en IS NULL
          AND EXISTS (SELECT 1 FROM estadias s WHERE s.huesped_id = h.id)
          AND NOT EXISTS (
            SELECT 1 FROM estadias s
             WHERE s.huesped_id = h.id
               AND (s.estado = 'ACTIVA' OR s.salida_real_en > $1::timestamptz - make_interval(days => $2::int)))
        RETURNING h.id`, [ahora, dias]);
    if (filas.length > 0) {
      // Una entrada por corrida, sin usuario (tarea programada) y sin el dato borrado: solo la cantidad.
      await auditar(tx, { usuarioId: null, accion: 'ANONIMIZAR', entidad: 'huespedes', entidadId: aBogota(ahora), detalle: { cantidad: String(filas.length) }, ocurrido: ahora });
    }
    return { anonimizados: filas.length };
  });
}

/** Corre la anonimización al arrancar y luego cada `cadaMs` (por defecto, cada hora). Devuelve cómo detenerla. */
export function programarAnonimizacion(bd: Bd, ahora: () => Date, o: {
  cadaMs?: number; alTerminar?: (r: { anonimizados: number }) => void; alFallar?: (error: unknown) => void;
} = {}): () => void {
  let corriendo = false;
  const correr = async () => {
    if (corriendo) return;
    corriendo = true;
    try { o.alTerminar?.(await anonimizarVencidos(bd, ahora())); }
    catch (error) { o.alFallar?.(error); }
    finally { corriendo = false; }
  };
  void correr();
  const id = setInterval(() => void correr(), o.cadaMs ?? 3_600_000);
  return () => clearInterval(id);
}
