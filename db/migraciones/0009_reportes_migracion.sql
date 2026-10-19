-- Hotel Golán · migración 0009: reportes de extranjeros a Migración Colombia (TICKET-37; PRD v0.7 FR-33, RN-24).
-- Quien aloje a un extranjero debe reportar su llegada y su salida por el SIRE (Decreto 1067 de 2015, art. 2.2.1.11.5.1;
-- Resolución 2357 de 2020) [V]. Hoy nadie lo hace (HG-ACT-001 V6-02). El sistema no se conecta al SIRE: lo pendiente se
-- calcula con las estadías de titulares extranjeros, y aquí queda solo la constancia de quién marcó «Ya lo reporté».

BEGIN;

CREATE TABLE reportes_migracion (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estadia_id     uuid NOT NULL REFERENCES estadias (id),
  tipo           text NOT NULL CHECK (tipo IN ('LLEGADA', 'SALIDA')),
  reportado_por  uuid NOT NULL REFERENCES usuarios (id),
  reportado_en   timestamptz NOT NULL,
  UNIQUE (estadia_id, tipo)
);

-- Horas para marcar un reporte como atrasado: el plazo exacto de la Resolución 2357 no se pudo leer [P/V].
ALTER TABLE reglas DROP CONSTRAINT reglas_clave_check;
ALTER TABLE reglas ADD CONSTRAINT reglas_clave_check CHECK (clave IN ('valor_hora', 'hora_noche_completa', 'descuento_noche', -- NOSONAR: valores permitidos del CHECK
  'pago_turno_dia', 'pago_turno_noche', 'retencion_datos_dias', 'minutos_cambio_sin_cargo', 'horas_reporte_migracion'));
INSERT INTO reglas (clave, valor) VALUES ('horas_reporte_migracion', 24) ON CONFLICT (clave) DO NOTHING;

COMMIT;
