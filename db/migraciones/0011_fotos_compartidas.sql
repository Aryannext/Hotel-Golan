-- Fotos de productos y habitaciones compartidas entre sesiones/equipos.
-- Sin cambios en cuentas, pagos, inventario ni estadías.
BEGIN;
CREATE TABLE fotos_compartidas (
  clave text PRIMARY KEY,
  producto_id uuid REFERENCES productos(id) ON DELETE CASCADE,
  habitacion_numero text REFERENCES habitaciones(numero) ON DELETE CASCADE,
  imagen bytea CHECK (octet_length(imagen) BETWEEN 1 AND 5242880),
  version uuid NOT NULL,
  actualizado_por uuid NOT NULL REFERENCES usuarios(id),
  actualizado_en timestamptz NOT NULL,
  CHECK ((producto_id IS NOT NULL AND habitacion_numero IS NULL AND clave = 'producto-' || producto_id::text)
      OR (producto_id IS NULL AND habitacion_numero IS NOT NULL AND clave = habitacion_numero))
);
-- imagen NULL conserva una marca de borrado para no reimportar una copia local vieja.

-- La bandeja de eventos tiene que aceptar el tipo nuevo. Una restricción CHECK no se
-- amplía: hay que reemplazarla. La lista de abajo es la de 0001 íntegra más
-- «foto.actualizada», así que es un superconjunto de la anterior y ninguna fila que ya
-- esté guardada puede quedar fuera.
--
-- IF EXISTS para que no reviente si la base no la tiene con ese nombre exacto; de que el
-- resultado sea el correcto se encarga la comprobación del final.
ALTER TABLE eventos_salida DROP CONSTRAINT IF EXISTS eventos_salida_tipo_check;
ALTER TABLE eventos_salida ADD CONSTRAINT eventos_salida_tipo_check CHECK (tipo IN (
  'habitacion.actualizada', 'estadia.creada', 'estadia.cerrada',
  'pago.por_verificar', 'pago.verificado', 'pago.rechazado',
  'turno.entregado', 'turno.recibido', 'turno.diferencia', 'caja.movimiento', 'foto.actualizada'
));

-- Red de seguridad: si sobreviviera una restricción vieja que no conoce el tipo nuevo,
-- este INSERT falla y revierte la migración entera. Vale más que no se aplique a que
-- quede a medias y la aplicación empiece a rechazar eventos en caliente.
INSERT INTO eventos_salida (tipo, payload) VALUES ('foto.actualizada', '{"comprobacion": "0011"}'::jsonb);
DELETE FROM eventos_salida WHERE tipo = 'foto.actualizada' AND payload->>'comprobacion' = '0011';
COMMIT;
