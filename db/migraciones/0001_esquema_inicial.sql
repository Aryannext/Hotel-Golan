-- Hotel Golán · migración 0001: esquema inicial de la primera entrega.
-- Fuente: docs/ARQUITECTURA.md §4 (ERD) y docs/ADR.md (ADR-004, ADR-008 y ADR-011). PostgreSQL 16.
-- Dinero: COP enteros. Fechas: timestamptz (se guarda en UTC; las reglas se calculan en America/Bogota).
-- Los estados se validan con CHECK en lugar de ENUM, para que agregar un valor sea una migración simple.

BEGIN;

CREATE TABLE usuarios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL CHECK (length(nombre) BETWEEN 2 AND 80),
  usuario           text NOT NULL UNIQUE CHECK (usuario ~ '^[a-z0-9._-]{3,40}$'),
  pin_hash          text NOT NULL,                                   -- Argon2id (ADR-003)
  rol               text NOT NULL CHECK (rol IN ('RECEPCION', 'ADMINISTRACION')),
  activo            boolean NOT NULL DEFAULT true,
  intentos_fallidos integer NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta   timestamptz,
  creado_en         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sesiones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios (id),
  token_hash  text NOT NULL UNIQUE,                                  -- nunca el token en claro
  creada_en   timestamptz NOT NULL DEFAULT now(),
  expira_en   timestamptz NOT NULL,
  revocada_en timestamptz,
  CHECK (expira_en > creada_en)
);

CREATE TABLE habitaciones (
  numero         text PRIMARY KEY CHECK (numero IN ('201','202','203','204','205','206','207','208','209','210','211','301')),
  tipo           text NOT NULL CHECK (tipo IN ('AIRE', 'VENTILADOR')),
  estado         text NOT NULL DEFAULT 'DISPONIBLE'
                 CHECK (estado IN ('DISPONIBLE', 'OCUPADA', 'POR_REVISAR', 'LIMPIEZA', 'MANTENIMIENTO')),
  nota           text,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE huespedes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                 text,                                       -- NULL tras anonimizar (FR-21)
  tipo_documento         text CHECK (tipo_documento IN ('CC', 'CE', 'TI', 'RC', 'PASAPORTE', 'PPT')),
  numero_documento       text CHECK (numero_documento ~ '^[A-Za-z0-9-]{4,20}$'),
  nacionalidad           text,
  telefono               text CHECK (telefono ~ '^\+57[0-9]{10}$'),
  es_menor               boolean NOT NULL DEFAULT false,
  acompanante_verificado boolean NOT NULL DEFAULT false,
  anonimizado_en         timestamptz,
  CHECK (NOT es_menor OR acompanante_verificado),                    -- RN-16
  CHECK (anonimizado_en IS NOT NULL OR nombre IS NOT NULL),
  CHECK (anonimizado_en IS NULL OR (nombre IS NULL AND numero_documento IS NULL AND telefono IS NULL))
);

CREATE TABLE autorizaciones_datos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huesped_id     uuid NOT NULL UNIQUE REFERENCES huespedes (id),
  version_aviso  text NOT NULL CHECK (version_aviso ~ '^AV-[0-9]{4}-[0-9]{2}$'),
  otorgada_en    timestamptz NOT NULL DEFAULT now(),
  registrada_por uuid NOT NULL REFERENCES usuarios (id)
);

CREATE TABLE turnos (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                        text NOT NULL CHECK (tipo IN ('DIA', 'NOCHE')), -- NOSONAR: valores permitidos del CHECK
  estado                      text NOT NULL CHECK (estado IN ('POR_RECIBIR', 'ABIERTO', 'CERRADO')), -- NOSONAR: valores permitidos del CHECK
  responsable_id              uuid REFERENCES usuarios (id),
  recibido_de_id              uuid REFERENCES usuarios (id),
  inicio_en                   timestamptz NOT NULL DEFAULT now(),
  fin_en                      timestamptz,
  base_entregada              integer NOT NULL CHECK (base_entregada >= 0),
  base_recibida               integer CHECK (base_recibida >= 0),
  motivo_diferencia_recepcion text,
  pago_turno                  integer CHECK (pago_turno >= 0),
  pago_tomado                 boolean,
  efectivo_esperado           integer,
  efectivo_contado            integer CHECK (efectivo_contado >= 0),
  motivo_diferencia           text,
  CHECK (estado = 'POR_RECIBIR' OR (responsable_id IS NOT NULL AND base_recibida IS NOT NULL)),
  CHECK (estado <> 'CERRADO' OR (fin_en IS NOT NULL AND efectivo_contado IS NOT NULL AND pago_tomado IS NOT NULL)),
  CHECK (estado <> 'CERRADO' OR efectivo_contado = efectivo_esperado OR length(coalesce(motivo_diferencia, '')) >= 5)   -- RN-11
);
-- Un solo turno activo (POR_RECIBIR o ABIERTO) a la vez (RN-09).
CREATE UNIQUE INDEX turnos_un_solo_activo ON turnos ((true)) WHERE estado IN ('POR_RECIBIR', 'ABIERTO');

CREATE TABLE estadias (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habitacion_numero  text NOT NULL REFERENCES habitaciones (numero),
  huesped_id         uuid NOT NULL REFERENCES huespedes (id),
  turno_id           uuid NOT NULL REFERENCES turnos (id),
  modalidad          text NOT NULL CHECK (modalidad IN ('NOCHE', 'TRES_HORAS', 'POR_HORAS')), -- NOSONAR: valores permitidos del CHECK
  personas           integer NOT NULL CHECK (personas BETWEEN 1 AND 3),
  noches             integer NOT NULL DEFAULT 1 CHECK (noches BETWEEN 1 AND 30),
  entrada_en         timestamptz NOT NULL,
  salida_prevista_en timestamptz NOT NULL,
  salida_real_en     timestamptz,
  estado             text NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'CERRADA', 'DESISTIDA')), -- NOSONAR: valores permitidos del CHECK
  forma_cobro        text NOT NULL CHECK (forma_cobro IN ('ANTICIPADO', 'AL_SALIR')),
  registro_tardio    boolean NOT NULL DEFAULT false,                 -- ADR-010
  creada_por         uuid NOT NULL REFERENCES usuarios (id),
  creada_en          timestamptz NOT NULL DEFAULT now(),
  CHECK (modalidad <> 'TRES_HORAS' OR personas <= 2),                -- RN-03
  CHECK (forma_cobro <> 'AL_SALIR' OR (modalidad = 'NOCHE' AND noches = 1)),   -- RN-06
  CHECK (salida_prevista_en > entrada_en),
  CHECK (estado = 'ACTIVA' OR salida_real_en IS NOT NULL)
);
-- Una sola estadía activa por habitación.
CREATE UNIQUE INDEX estadias_una_activa_por_habitacion ON estadias (habitacion_numero) WHERE estado = 'ACTIVA';
CREATE INDEX estadias_anonimizacion ON estadias (salida_real_en) WHERE estado <> 'ACTIVA';

CREATE TABLE productos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL CHECK (length(nombre) BETWEEN 2 AND 80),
  grupo       text NOT NULL CHECK (grupo IN ('NEVERA', 'VITRINA_ASEO', 'VITRINA_PASABOCAS', 'LAVANDERIA', 'OTROS')),
  precio      integer NOT NULL CHECK (precio >= 0),
  seccion     integer CHECK (seccion BETWEEN 1 AND 6),
  pertenece_a text NOT NULL DEFAULT 'HOTEL' CHECK (pertenece_a IN ('HOTEL', 'FAMILIAR')),   -- RN-13
  activo      boolean NOT NULL DEFAULT true,
  UNIQUE (grupo, nombre)
);

CREATE TABLE cargos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estadia_id       uuid NOT NULL REFERENCES estadias (id),
  producto_id      uuid REFERENCES productos (id),
  tipo             text NOT NULL CHECK (tipo IN ('ALOJAMIENTO', 'DESCUENTO', 'EXTENSION', 'PRODUCTO', 'LLAVE', 'RECARGO_ASEO', 'DANO')), -- NOSONAR: valores permitidos del CHECK
  concepto         text NOT NULL,
  cantidad         integer NOT NULL DEFAULT 1 CHECK (cantidad >= 1),
  valor_unitario   integer NOT NULL,
  valor            integer NOT NULL,
  creado_por       uuid NOT NULL REFERENCES usuarios (id),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  anulado_en       timestamptz,
  anulado_por      uuid REFERENCES usuarios (id),
  motivo_anulacion text,
  CHECK ((tipo = 'DESCUENTO' AND valor <= 0) OR (tipo <> 'DESCUENTO' AND valor >= 0)),       -- RN-05
  CHECK (valor = valor_unitario * cantidad),
  CHECK (anulado_en IS NULL OR (anulado_por IS NOT NULL AND length(coalesce(motivo_anulacion, '')) >= 5))
);

CREATE TABLE pagos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estadia_id         uuid NOT NULL REFERENCES estadias (id),
  turno_id           uuid NOT NULL REFERENCES turnos (id),
  medio              text NOT NULL CHECK (medio IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA')), -- NOSONAR: valores permitidos del CHECK
  valor              integer NOT NULL CHECK (valor > 0),
  estado             text NOT NULL CHECK (estado IN ('EN_CAJA', 'POR_VERIFICAR', 'VERIFICADO', 'RECHAZADO')), -- NOSONAR: valores permitidos del CHECK
  registrado_por     uuid NOT NULL REFERENCES usuarios (id),
  registrado_en      timestamptz NOT NULL DEFAULT now(),
  verificado_por     uuid REFERENCES usuarios (id),
  verificado_en      timestamptz,
  anulado_en         timestamptz,
  anulado_por        uuid REFERENCES usuarios (id),
  motivo_anulacion   text,
  clave_idempotencia uuid UNIQUE,                                    -- ADR-008
  -- RN-10/RN-12: el efectivo va a la caja; las transferencias esperan verificación.
  CHECK ((medio = 'EFECTIVO' AND estado = 'EN_CAJA') OR (medio <> 'EFECTIVO' AND estado IN ('POR_VERIFICAR', 'VERIFICADO', 'RECHAZADO'))),
  CHECK (estado NOT IN ('VERIFICADO', 'RECHAZADO') OR (verificado_por IS NOT NULL AND verificado_en IS NOT NULL)),
  CHECK (anulado_en IS NULL OR (anulado_por IS NOT NULL AND length(coalesce(motivo_anulacion, '')) >= 5))
);
CREATE INDEX pagos_por_turno ON pagos (turno_id);
CREATE INDEX pagos_por_verificar ON pagos (registrado_en) WHERE estado = 'POR_VERIFICAR' AND anulado_en IS NULL;

CREATE TABLE movimientos_caja (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id           uuid NOT NULL REFERENCES turnos (id),
  tipo               text NOT NULL CHECK (tipo IN ('COMPRA_HOTEL', 'RETIRO_ADMINISTRACION', 'DEVOLUCION', 'RECARGO_ASEO', 'OTRO')),
  detalle            text NOT NULL CHECK (length(detalle) BETWEEN 3 AND 200),
  valor              integer NOT NULL CHECK (valor > 0),
  habitacion_numero  text REFERENCES habitaciones (numero),
  registrado_por     uuid NOT NULL REFERENCES usuarios (id),
  registrado_en      timestamptz NOT NULL DEFAULT now(),
  anulado_en         timestamptz,
  anulado_por        uuid REFERENCES usuarios (id),
  motivo_anulacion   text,
  clave_idempotencia uuid UNIQUE,
  CHECK (anulado_en IS NULL OR (anulado_por IS NOT NULL AND length(coalesce(motivo_anulacion, '')) >= 5))
);
CREATE INDEX movimientos_caja_por_turno ON movimientos_caja (turno_id);

CREATE TABLE devoluciones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estadia_id         uuid NOT NULL UNIQUE REFERENCES estadias (id),  -- sin doble devolución (RN-08)
  pago_id            uuid REFERENCES pagos (id),
  motivo             text NOT NULL CHECK (motivo IN ('SOLO_MIRO', 'YA_USO')),
  valor              integer NOT NULL CHECK (valor >= 0),
  medio              text NOT NULL CHECK (medio IN ('EFECTIVO', 'TRANSFERENCIA')),
  movimiento_caja_id uuid UNIQUE REFERENCES movimientos_caja (id),
  registrada_por     uuid NOT NULL REFERENCES usuarios (id),
  registrada_en      timestamptz NOT NULL DEFAULT now(),
  CHECK (motivo <> 'YA_USO' OR valor = 0),
  CHECK (medio <> 'EFECTIVO' OR valor = 0 OR movimiento_caja_id IS NOT NULL)
);

CREATE TABLE tarifas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_habitacion text NOT NULL CHECK (tipo_habitacion IN ('AIRE', 'VENTILADOR')),
  modalidad       text NOT NULL CHECK (modalidad IN ('NOCHE', 'TRES_HORAS')),
  personas        integer NOT NULL CHECK (personas BETWEEN 1 AND 3),
  valor           integer NOT NULL CHECK (valor > 0),
  vigente_desde   timestamptz NOT NULL DEFAULT now(),
  CHECK (modalidad <> 'TRES_HORAS' OR personas = 2),                 -- precio único para 1 o 2 (H-04)
  UNIQUE (tipo_habitacion, modalidad, personas, vigente_desde)
);

CREATE TABLE reglas (
  clave           text PRIMARY KEY CHECK (clave IN ('valor_hora', 'hora_noche_completa', 'descuento_noche',
                                                    'pago_turno_dia', 'pago_turno_noche', 'retencion_datos_dias')),
  valor           integer NOT NULL CHECK (valor >= 0),
  actualizado_por uuid REFERENCES usuarios (id),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auditoria (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  uuid REFERENCES usuarios (id),                         -- NULL = tarea programada
  accion      text NOT NULL CHECK (accion IN ('CREAR', 'ACTUALIZAR', 'ANULAR', 'VERIFICAR', 'INICIAR_SESION',
                                              'CERRAR_SESION', 'BLOQUEAR', 'ENTREGAR_TURNO', 'RECIBIR_TURNO', 'ANONIMIZAR')),
  entidad     text NOT NULL,
  entidad_id  text NOT NULL,
  detalle     jsonb NOT NULL DEFAULT '{}'::jsonb,                    -- sin datos personales (ADR-006)
  ocurrido_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_por_entidad ON auditoria (entidad, entidad_id);

-- ---------- Tablas internas (ADR-011), sin recurso en la API ----------

-- Bandeja de entrada (inbox): resultado guardado de cada Idempotency-Key, para no repetir efectos.
CREATE TABLE solicitudes_idempotentes (
  clave       uuid PRIMARY KEY,
  usuario_id  uuid REFERENCES usuarios (id),
  operacion   text NOT NULL,                                         -- p. ej. 'verificarPago'
  estado_http integer NOT NULL,
  respuesta   jsonb NOT NULL,
  creada_en   timestamptz NOT NULL DEFAULT now()
);

-- Bandeja de salida (outbox): eventos para SSE, escritos en la misma transacción que el cambio.
CREATE TABLE eventos_salida (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,      -- se usa como Last-Event-ID
  tipo         text NOT NULL CHECK (tipo IN ('habitacion.actualizada', 'estadia.creada', 'estadia.cerrada',
                                             'pago.por_verificar', 'pago.verificado', 'pago.rechazado',
                                             'turno.entregado', 'turno.recibido', 'turno.diferencia', 'caja.movimiento')),
  payload      jsonb NOT NULL,                                       -- sin datos personales
  ocurrido_en  timestamptz NOT NULL DEFAULT now(),
  publicado_en timestamptz
);
CREATE INDEX eventos_salida_pendientes ON eventos_salida (id) WHERE publicado_en IS NULL;

COMMIT;
