-- Hotel Golán · migración 0011: cierre de un turno trabado por la administración (HG-HAL-001 HAL-18) [P/V].
-- Si quien tenía el turno se fue sin entregarlo, la administración cuenta la plata y lo cierra con un motivo.
-- Se guarda quién lo cerró, para que el historial no diga que lo entregó quien se fue. Vacío = lo entregó su responsable.

BEGIN;

ALTER TABLE turnos
  ADD COLUMN cerrado_por_id uuid REFERENCES usuarios (id),
  ADD COLUMN motivo_cierre  text CHECK (length(motivo_cierre) BETWEEN 5 AND 300),
  ADD CONSTRAINT turnos_cierre_con_motivo CHECK ((cerrado_por_id IS NULL) = (motivo_cierre IS NULL));

COMMIT;
