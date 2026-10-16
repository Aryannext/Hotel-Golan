# 03: Recibir el turno y ver la caja

**ID:** TICKET-03
**Requisitos:** FR-14, FR-11; RN-09, RN-10, RN-11 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Si hay un turno «por recibir», quien entra confirma con un toque el efectivo que contó, o escribe otro valor con su motivo. Luego ve «En la caja debe haber» (base + efectivo − salidas), las transferencias aparte y cuántas faltan por verificar.

**Blocked by:** TICKET-01 (Iniciar sesión y ver el mapa de habitaciones)

**Status:** done (16-10-2026)

## Invariantes de negocio
- Un solo turno activo (índice único ya en el esquema).
- Sin turno ABIERTO no se puede cobrar: 409 SIN_TURNO_ABIERTO.
- «Debe haber» = base_recibida + efectivo EN_CAJA no anulado − salidas no anuladas; las transferencias no suman.
- Si lo contado al recibir ≠ base_entregada, el motivo es obligatorio y se emite `turno.diferencia` a la administración.
- La administración no recibe turnos (403).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] GET /turnos/actual y POST /turnos/actual/recepcion cumplen el contrato.
- [x] Con la semilla, la caja muestra base $208.500, efectivo $26.000, «debe haber» $234.500 y transferencias $85.000.
- [x] Pasan los escenarios «Recibir el turno con un toque» y «Recibir con diferencia avisa a la administración».
- [x] La PWA tiene la pantalla de recibir turno al iniciar sesión y la pantalla de caja de recepción.

## Módulos a tocar
caja (turnos), cobros (lectura de pagos), PWA (recibir turno y caja).

## Verificación
`npm test -- --test-name-pattern="RN-09|RN-10|recibir" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- Módulo `caja/turnos.ts`: `GET /turnos/actual` (recepción y administración) y `POST /turnos/actual/recepcion` (solo recepción). 14 pruebas: caja de la semilla ($208.500 + $26.000 = $234.500; transferencias $85.000; 1 por verificar; pago del turno $50.000), salida de dinero, lo anulado y lo rechazado no cuentan, recibir con un toque, 422 MOTIVO_REQUERIDO, evento `turno.diferencia`, 403 para la administración, 409 si ya se recibió, 400 por datos inválidos y `turnoAbiertoId` → 409 SIN_TURNO_ABIERTO (lo usará el TICKET-04).
- Núcleo `reglas`: `finProgramadoTurno` (RN-09), 6 pruebas.
- Decisiones de diseño [P]: al recibir, `inicio_en` pasa a la hora en que se recibió; mientras el turno está por recibir, la caja muestra lo entregado; `responsable` y `recibido_de` devuelven el usuario (como en los escenarios). Si dos personas reciben a la vez, solo una lo logra (la otra recibe 409).
- PWA: pantalla «Recibir el turno» al entrar (un toque o «Conté otro valor», con «Faltan/Sobran» en vivo y motivo obligatorio) y pestaña «Caja» con «En la caja debe haber». Lógica de presentación probada (3 pruebas).
- Probado en el navegador contra Docker: caja de la semilla $234.500; turno por recibir de $184.500 recibido con $183.000 y motivo → caja $183.000; en la base quedaron `turno.recibido`, `turno.diferencia` y la auditoría RECIBIR_TURNO. Vista de celular (375 px) sin desbordes. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 107 pruebas en verde (84 anteriores + 14 de turnos + 6 de reglas + 3 de presentación); tipos limpios.
