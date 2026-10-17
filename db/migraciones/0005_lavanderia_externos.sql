-- Hotel Golán · migración 0005: lavandería para externos (segunda entrega, TICKET-24; PRD v0.4 FR-27, RN-22).
-- Un externo no tiene cuenta de habitación: su pago queda en `pagos` con `pedido_lavanderia_id`.
-- Cada pago tiene un solo dueño: una estadía, una venta de contado o un pedido de lavandería de un externo.
-- El nombre del externo se anonimiza con la misma política de los huéspedes (90 días [P/V], RN-16).

BEGIN;

ALTER TABLE pagos ADD COLUMN pedido_lavanderia_id uuid REFERENCES pedidos_lavanderia (id);
ALTER TABLE pagos DROP CONSTRAINT pagos_estadia_o_venta;
ALTER TABLE pagos ADD CONSTRAINT pagos_un_dueno CHECK (num_nonnulls(estadia_id, venta_id, pedido_lavanderia_id) = 1);
CREATE INDEX pagos_por_pedido_lavanderia ON pagos (pedido_lavanderia_id) WHERE pedido_lavanderia_id IS NOT NULL;

ALTER TABLE pedidos_lavanderia ADD COLUMN anonimizado_en timestamptz;

COMMIT;
