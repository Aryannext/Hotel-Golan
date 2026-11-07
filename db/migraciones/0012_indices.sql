-- Hotel Golán · migración 0012: índices de las consultas por estadía, huésped, turno, venta, pedido y usuario
-- (HG-HAL-001 HAL-36). Con los meses, sin ellos cada ficha, cuenta y turno recorre la tabla completa.

BEGIN;

CREATE INDEX IF NOT EXISTS cargos_por_estadia ON cargos (estadia_id);
CREATE INDEX IF NOT EXISTS pagos_por_estadia ON pagos (estadia_id);
CREATE INDEX IF NOT EXISTS ventas_items_por_venta ON ventas_items (venta_id);
CREATE INDEX IF NOT EXISTS pedidos_lavanderia_items_por_pedido ON pedidos_lavanderia_items (pedido_id);
CREATE INDEX IF NOT EXISTS pedidos_lavanderia_por_estadia ON pedidos_lavanderia (estadia_id);
CREATE INDEX IF NOT EXISTS estadias_por_huesped ON estadias (huesped_id);
CREATE INDEX IF NOT EXISTS estadias_por_turno ON estadias (turno_id);
CREATE INDEX IF NOT EXISTS sesiones_por_usuario ON sesiones (usuario_id);

COMMIT;
