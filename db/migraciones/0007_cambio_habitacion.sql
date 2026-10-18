-- Hotel Golán · migración 0007: cambio de habitación (TICKET-26; PRD v0.6 FR-30, RN-17).
-- Reglas de la administradora (HG-ACT-001 V5-03 a V5-05): a los pocos minutos de entrar se ajusta la diferencia;
-- si se pasa a una más barata, se le devuelve en efectivo con una salida de caja ligada a la estadía.
-- «Pocos minutos» («3 o 5») queda configurable: 5 por omisión [P/V].

BEGIN;

ALTER TABLE reglas DROP CONSTRAINT reglas_clave_check;
ALTER TABLE reglas ADD CONSTRAINT reglas_clave_check CHECK (clave IN ('valor_hora', 'hora_noche_completa', 'descuento_noche', -- NOSONAR: valores permitidos del CHECK
  'pago_turno_dia', 'pago_turno_noche', 'retencion_datos_dias', 'minutos_cambio_sin_cargo'));
INSERT INTO reglas (clave, valor) VALUES ('minutos_cambio_sin_cargo', 5) ON CONFLICT (clave) DO NOTHING;

-- Una devolución de la diferencia queda ligada a su estadía: la cuenta la descuenta de lo pagado.
ALTER TABLE movimientos_caja ADD COLUMN estadia_id uuid REFERENCES estadias (id);
ALTER TABLE movimientos_caja ADD CONSTRAINT movimientos_estadia_solo_devolucion CHECK (estadia_id IS NULL OR tipo = 'DEVOLUCION');
CREATE INDEX movimientos_caja_por_estadia ON movimientos_caja (estadia_id) WHERE estadia_id IS NOT NULL;

COMMIT;
