-- Hotel Golán · migración 0008: auditar las consultas de datos personales (TICKET-34; PRD v0.6 FR-31, RN-16).
-- La lista de «quiénes se quedan hoy» muestra el documento completo para la ronda de la policía (HG-ACT-001 V5-02);
-- cada vez que alguien la abre queda constancia de quién y cuándo, sin los datos.

BEGIN;

ALTER TABLE auditoria DROP CONSTRAINT auditoria_accion_check;
ALTER TABLE auditoria ADD CONSTRAINT auditoria_accion_check CHECK (accion IN ('CREAR', 'ACTUALIZAR', 'ANULAR', 'VERIFICAR', -- NOSONAR: valores permitidos del CHECK
  'INICIAR_SESION', 'CERRAR_SESION', 'BLOQUEAR', 'ENTREGAR_TURNO', 'RECIBIR_TURNO', 'ANONIMIZAR', 'CONSULTAR'));

COMMIT;
