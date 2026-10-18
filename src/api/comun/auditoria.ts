// Registro de auditoría de solo inserción (FR-20). El detalle nunca lleva datos personales ni secretos.
import type { Bd } from '../../../scripts/lib/bd.ts';

export type AccionAuditoria =
  | 'CREAR' | 'ACTUALIZAR' | 'ANULAR' | 'VERIFICAR' | 'INICIAR_SESION' | 'CERRAR_SESION'
  | 'BLOQUEAR' | 'ENTREGAR_TURNO' | 'RECIBIR_TURNO' | 'ANONIMIZAR' | 'CONSULTAR';

export interface RegistroAuditoria {
  usuarioId: string | null; accion: AccionAuditoria; entidad: string; entidadId: string; detalle?: Record<string, string>; ocurrido: Date;
}

export async function auditar(bd: Bd, e: RegistroAuditoria): Promise<void> {
  await bd.consultar(
    'INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ocurrido_en) VALUES ($1, $2, $3, $4, $5, $6)',
    [e.usuarioId, e.accion, e.entidad, e.entidadId, JSON.stringify(e.detalle ?? {}), e.ocurrido],
  );
}

/** Varios registros en una sola consulta, en el orden dado. */
export async function auditarVarios(bd: Bd, registros: RegistroAuditoria[]): Promise<void> {
  if (registros.length === 0) return;
  await bd.consultar(
    `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ocurrido_en)
     SELECT a.usuario_id, a.accion, a.entidad, a.entidad_id, a.detalle::jsonb, a.ocurrido_en
       FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::timestamptz[]) WITH ORDINALITY
            AS a(usuario_id, accion, entidad, entidad_id, detalle, ocurrido_en, n)
      ORDER BY a.n`,
    [registros.map((r) => r.usuarioId), registros.map((r) => r.accion), registros.map((r) => r.entidad),
      registros.map((r) => r.entidadId), registros.map((r) => JSON.stringify(r.detalle ?? {})), registros.map((r) => r.ocurrido)],
  );
}
