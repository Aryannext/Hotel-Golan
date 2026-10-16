// Registro de auditoría de solo inserción (FR-20). El detalle nunca lleva datos personales ni secretos.
import type { Bd } from '../../../scripts/lib/bd.ts';

export type AccionAuditoria =
  | 'CREAR' | 'ACTUALIZAR' | 'ANULAR' | 'VERIFICAR' | 'INICIAR_SESION' | 'CERRAR_SESION'
  | 'BLOQUEAR' | 'ENTREGAR_TURNO' | 'RECIBIR_TURNO' | 'ANONIMIZAR';

export async function auditar(
  bd: Bd,
  e: { usuarioId: string | null; accion: AccionAuditoria; entidad: string; entidadId: string; detalle?: Record<string, string>; ocurrido: Date },
): Promise<void> {
  await bd.consultar(
    'INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ocurrido_en) VALUES ($1, $2, $3, $4, $5, $6)',
    [e.usuarioId, e.accion, e.entidad, e.entidadId, JSON.stringify(e.detalle ?? {}), e.ocurrido],
  );
}
