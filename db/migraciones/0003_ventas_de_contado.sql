-- Hotel Golán · migración 0003: venta de contado (segunda entrega, TICKET-22; PRD v0.4 FR-26, RN-20).
-- Una venta no tiene habitación: su único pago queda en `pagos` con `venta_id` en lugar de `estadia_id`,
-- así la caja del turno, «Por confirmar», la anulación y el historial la cuentan sin cambios.
-- Una venta está anulada cuando su pago está anulado (ADR-008: nada se borra).

BEGIN;

CREATE TABLE ventas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id           uuid NOT NULL REFERENCES turnos (id),
  total              integer NOT NULL CHECK (total > 0),
  registrado_por     uuid NOT NULL REFERENCES usuarios (id),
  registrado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ventas_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id       uuid NOT NULL REFERENCES ventas (id),
  orden          integer NOT NULL CHECK (orden >= 1),          -- orden en que se vendió (para mostrar el detalle)
  producto_id    uuid NOT NULL REFERENCES productos (id),
  concepto       text NOT NULL,
  cantidad       integer NOT NULL CHECK (cantidad >= 1),
  valor_unitario integer NOT NULL CHECK (valor_unitario >= 0),
  valor          integer NOT NULL,
  CHECK (valor = valor_unitario * cantidad)
);
CREATE INDEX ventas_items_producto ON ventas_items (producto_id);

ALTER TABLE pagos ALTER COLUMN estadia_id DROP NOT NULL;
ALTER TABLE pagos ADD COLUMN venta_id uuid REFERENCES ventas (id);
-- Cada pago es de una estadía o de una venta, nunca de las dos ni de ninguna.
ALTER TABLE pagos ADD CONSTRAINT pagos_estadia_o_venta CHECK ((estadia_id IS NULL) <> (venta_id IS NULL));
CREATE UNIQUE INDEX pagos_una_por_venta ON pagos (venta_id) WHERE venta_id IS NOT NULL;

COMMIT;
