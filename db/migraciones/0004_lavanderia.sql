-- Hotel Golán · migración 0004: pedidos de lavandería (segunda entrega, TICKET-23; PRD v0.4 FR-27, RN-22).
-- Un pedido es de una estadía (huésped: se carga a su cuenta) o, desde el TICKET-24, de una persona externa (solo su nombre).
-- Se entrega cobrando o, sin pago, con la autorización registrada de quien entrega; la deuda sigue en la cuenta (RN-07).

BEGIN;

CREATE TABLE pedidos_lavanderia (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estadia_id              uuid REFERENCES estadias (id),
  cliente_nombre          text CHECK (cliente_nombre IS NULL OR length(cliente_nombre) BETWEEN 2 AND 120),
  turno_id                uuid NOT NULL REFERENCES turnos (id),
  total                   integer NOT NULL CHECK (total > 0),
  estado                  text NOT NULL DEFAULT 'RECIBIDO' CHECK (estado IN ('RECIBIDO', 'ENTREGADO')),
  registrado_por          uuid NOT NULL REFERENCES usuarios (id),
  registrado_en           timestamptz NOT NULL DEFAULT now(),
  entregado_por           uuid REFERENCES usuarios (id),
  entregado_en            timestamptz,
  sin_pago_autorizado_por uuid REFERENCES usuarios (id),
  CHECK ((estadia_id IS NULL) <> (cliente_nombre IS NULL)),
  CHECK (estado <> 'ENTREGADO' OR (entregado_por IS NOT NULL AND entregado_en IS NOT NULL))
);
CREATE INDEX pedidos_lavanderia_pendientes ON pedidos_lavanderia (registrado_en) WHERE estado = 'RECIBIDO';

CREATE TABLE pedidos_lavanderia_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id      uuid NOT NULL REFERENCES pedidos_lavanderia (id),
  orden          integer NOT NULL CHECK (orden >= 1),
  producto_id    uuid NOT NULL REFERENCES productos (id),
  concepto       text NOT NULL,
  cantidad       integer NOT NULL CHECK (cantidad >= 1),
  valor_unitario integer NOT NULL CHECK (valor_unitario >= 0),
  valor          integer NOT NULL,
  CHECK (valor = valor_unitario * cantidad)
);

-- Los cargos de lavandería de un huésped quedan unidos a su pedido.
ALTER TABLE cargos ADD COLUMN pedido_lavanderia_id uuid REFERENCES pedidos_lavanderia (id);

COMMIT;
