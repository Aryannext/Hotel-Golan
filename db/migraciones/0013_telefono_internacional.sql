-- Hotel Golán · migración 0013: teléfono del huésped de otros países (HG-HAL-001 BD-18; decisión del usuario,
-- 27-10-2026). Sigue siendo opcional. Formato internacional (E.164): + y el código del país, de 7 a 15 dígitos en total.
-- Antes solo se aceptaba +57 con 10 dígitos, así que un extranjero no podía dejar el suyo.

BEGIN;

ALTER TABLE huespedes DROP CONSTRAINT IF EXISTS huespedes_telefono_check;
ALTER TABLE huespedes ADD CONSTRAINT huespedes_telefono_check CHECK (telefono ~ '^\+[1-9][0-9]{6,14}$'); -- NOSONAR: valores del CHECK

COMMIT;
