-- Hotel Golán · migración 0010: datos del hotel para el aviso de privacidad (TICKET-28; PRD v0.7 FR-05, RN-16; ADR-006).
-- El aviso debe decir quién es el responsable y cómo contactarlo (Decreto 1074 de 2015, art. 2.2.2.25.3.3) [V].
-- Esos datos no van en el código, que es público: la administración los escribe en Ajustes. Una sola fila.

BEGIN;

CREATE TABLE datos_hotel (
  unica           boolean PRIMARY KEY DEFAULT true CHECK (unica),
  responsable     text CHECK (length(responsable) BETWEEN 3 AND 120),
  nit             text CHECK (nit ~ '^[0-9.-]{5,20}$'),
  rnt             text CHECK (rnt ~ '^[0-9]{3,10}$'),
  direccion       text CHECK (length(direccion) BETWEEN 5 AND 120),
  telefono        text CHECK (telefono ~ '^[0-9]{7,10}$'),
  actualizado_por uuid REFERENCES usuarios (id),
  actualizado_en  timestamptz
);
INSERT INTO datos_hotel (unica) VALUES (true);

COMMIT;
