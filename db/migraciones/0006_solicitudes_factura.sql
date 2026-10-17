-- Hotel Golán · migración 0006: solicitudes de factura (segunda entrega, TICKET-25; PRD v0.4 FR-28, RN-23).
-- Recepción anota el RUT o NIT y el correo o el teléfono; la administración se los pasa al contador, que hace la
-- factura y se la envía al huésped. El sistema NO hace facturas (SOW §5).
-- Los datos se borran con la anonimización del huésped (90 días [P/V], RN-16); el estado y las fechas se conservan.

BEGIN;

CREATE TABLE solicitudes_factura (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estadia_id     uuid NOT NULL REFERENCES estadias (id),
  documento      text,
  correo         text,
  telefono       text,
  estado         text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'ENVIADA_AL_CONTADOR', 'ENTREGADA')),
  fecha_prevista date NOT NULL,
  registrada_por uuid NOT NULL REFERENCES usuarios (id),
  registrada_en  timestamptz NOT NULL DEFAULT now(),
  enviada_por    uuid REFERENCES usuarios (id),
  enviada_en     timestamptz,
  entregada_por  uuid REFERENCES usuarios (id),
  entregada_en   timestamptz,
  anonimizado_en timestamptz,
  CHECK (anonimizado_en IS NOT NULL OR (documento IS NOT NULL AND (correo IS NOT NULL OR telefono IS NOT NULL))),
  CHECK (anonimizado_en IS NULL OR (documento IS NULL AND correo IS NULL AND telefono IS NULL)),
  CHECK (estado = 'PENDIENTE' OR (enviada_por IS NOT NULL AND enviada_en IS NOT NULL)),
  CHECK (estado <> 'ENTREGADA' OR (entregada_por IS NOT NULL AND entregada_en IS NOT NULL))
);
CREATE INDEX solicitudes_factura_por_estadia ON solicitudes_factura (estadia_id);
CREATE INDEX solicitudes_factura_abiertas ON solicitudes_factura (registrada_en) WHERE estado <> 'ENTREGADA';

COMMIT;
