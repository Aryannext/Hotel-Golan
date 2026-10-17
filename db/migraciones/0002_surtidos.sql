-- Hotel Golán · migración 0002: surtido de vitrina y nevera (segunda entrega, TICKET-21; PRD v0.4 FR-25, RN-21).
-- Las existencias no se guardan: se calculan con el surtido menos los cargos de producto vigentes
-- (y, desde el TICKET-22, las ventas de contado vigentes). Nada se borra: un surtido mal anotado se anula (ADR-008).

BEGIN;

CREATE TABLE surtidos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      uuid NOT NULL REFERENCES productos (id),
  cantidad         integer NOT NULL CHECK (cantidad >= 1),
  registrado_por   uuid NOT NULL REFERENCES usuarios (id),
  registrado_en    timestamptz NOT NULL DEFAULT now(),
  anulado_en       timestamptz,
  anulado_por      uuid REFERENCES usuarios (id),
  motivo_anulacion text,
  CHECK (anulado_en IS NULL OR (anulado_por IS NOT NULL AND length(coalesce(motivo_anulacion, '')) >= 5))
);
CREATE INDEX surtidos_producto ON surtidos (producto_id) WHERE anulado_en IS NULL;

COMMIT;
