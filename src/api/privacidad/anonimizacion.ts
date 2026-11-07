// Anonimización (FR-21, RN-16, ADR-006): borra nombre, documento y teléfono de los huéspedes cuya última estadía
// terminó hace más de `retencion_datos_dias` (90 [P/V]), y el nombre de los externos de lavandería entregados hace más
// de ese plazo (TICKET-24). Las solicitudes de factura de un huésped anonimizado pierden RUT, correo y teléfono
// (TICKET-25). Importes, cargos, pagos y autorización se conservan. La misma tarea purga las Idempotency-Key de más
// de 30 días (ADR-011).
// Es idempotente: un huésped ya anonimizado no se vuelve a tocar ni a auditar.
import type { Bd } from '../../../scripts/lib/bd.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { regla } from '../configuracion/reglas.ts';

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
    // Externos de lavandería (TICKET-24): solo su nombre, con el mismo plazo, contado desde la entrega [P/V].
    const externos = await tx.consultar<{ id: string }>(
      `UPDATE pedidos_lavanderia SET cliente_nombre = 'Externo anonimizado', anonimizado_en = $1
        WHERE cliente_nombre IS NOT NULL AND anonimizado_en IS NULL AND estado = 'ENTREGADO'
          AND entregado_en < $1::timestamptz - make_interval(days => $2::int)
        RETURNING id`, [ahora, dias]);
    if (externos.length > 0) {
      await auditar(tx, { usuarioId: null, accion: 'ANONIMIZAR', entidad: 'pedidos_lavanderia', entidadId: aBogota(ahora), detalle: { cantidad: String(externos.length) }, ocurrido: ahora });
    }
    // Solicitudes de factura (TICKET-25): siguen a su huésped; se conservan el estado y las fechas.
    const solicitudes = await tx.consultar<{ id: string }>(
      `UPDATE solicitudes_factura s SET documento = NULL, correo = NULL, telefono = NULL, anonimizado_en = $1
         FROM estadias e JOIN huespedes h ON h.id = e.huesped_id
        WHERE e.id = s.estadia_id AND h.anonimizado_en IS NOT NULL AND s.anonimizado_en IS NULL
        RETURNING s.id`, [ahora]);
    if (solicitudes.length > 0) {
      await auditar(tx, { usuarioId: null, accion: 'ANONIMIZAR', entidad: 'solicitudes_factura', entidadId: aBogota(ahora), detalle: { cantidad: String(solicitudes.length) }, ocurrido: ahora });
    }
    return { anonimizados: filas.length + externos.length + solicitudes.length };
  });
}

/** Días que se guarda la respuesta de una Idempotency-Key (ADR-011): basta para los reintentos y no conserva para
 * siempre lo que la respuesta traiga del huésped (HG-HAL-001, HAL-04). Cuenta con la hora de la base (`creada_en`). */
export const DIAS_SOLICITUDES = 30;

export async function purgarSolicitudesVencidas(bd: Bd, ahora: Date): Promise<{ purgadas: number }> {
  const filas = await bd.consultar<{ clave: string }>(
    'DELETE FROM solicitudes_idempotentes WHERE creada_en < $1::timestamptz - make_interval(days => $2::int) RETURNING clave',
    [ahora, DIAS_SOLICITUDES]);
  return { purgadas: filas.length };
}

/**
 * Lo técnico que solo crece y no lleva dinero (HG-HAL-001 HAL-46; ADR-011): sesiones vencidas o cerradas hace más de
 * 30 días y eventos de la bandeja de salida ya publicados hace más de 30 días. Los sin publicar se quedan.
 */
export async function purgarTecnico(bd: Bd, ahora: Date): Promise<{ sesiones: number; eventos: number }> {
  const sesiones = await bd.consultar<{ id: string }>(
    `DELETE FROM sesiones WHERE coalesce(revocada_en, expira_en) < $1::timestamptz - make_interval(days => $2::int) RETURNING id`,
    [ahora, DIAS_SOLICITUDES]);
  const eventos = await bd.consultar<{ id: string }>(
    `DELETE FROM eventos_salida WHERE publicado_en < $1::timestamptz - make_interval(days => $2::int) RETURNING id`,
    [ahora, DIAS_SOLICITUDES]);
  return { sesiones: sesiones.length, eventos: eventos.length };
}

/** Corre la anonimización al arrancar y luego cada `cadaMs` (por defecto, cada hora). Devuelve cómo detenerla. */
export function programarAnonimizacion(bd: Bd, ahora: () => Date, o: {
  cadaMs?: number; alTerminar?: (r: { anonimizados: number }) => void; alFallar?: (error: unknown) => void;
} = {}): () => void {
  let corriendo = false;
  const correr = async () => {
    if (corriendo) return;
    corriendo = true;
    try {
      const momento = ahora();
      const r = await anonimizarVencidos(bd, momento);
      await purgarSolicitudesVencidas(bd, momento);
      await purgarTecnico(bd, momento);
      o.alTerminar?.(r);
    }
    catch (error) { o.alFallar?.(error); }
    finally { corriendo = false; }
  };
  void correr();
  const id = setInterval(() => void correr(), o.cadaMs ?? 3_600_000);
  return () => clearInterval(id);
}
