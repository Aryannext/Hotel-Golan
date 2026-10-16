# 04: Registrar una entrada pagada en efectivo

**ID:** TICKET-04
**Requisitos:** FR-03, FR-05; RN-06, RN-16, RN-17 (solo validación de disponibilidad) (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La recepcionista completa el asistente: datos del titular (solo el titular; documento opcional; menor con acompañante verificado), casilla «el huésped autorizó» con la versión del aviso, habitación, tarifa y pago en efectivo con vueltas. La habitación queda ocupada y la caja del turno sube.

**Blocked by:** TICKET-02 (Cotizar una estadía (precio y hora de salida)), TICKET-03 (Recibir el turno y ver la caja)

**Status:** ready-for-agent

## Invariantes de negocio
- Sin autorización → 422 AUTORIZACION_REQUERIDA; se guardan versión del aviso, hora y quién la registró.
- Menor sin acompañante verificado → 400.
- Habitación no DISPONIBLE → 409 HABITACION_NO_DISPONIBLE, con bloqueo de fila para que dos personas no tomen la misma habitación.
- Varias noches con AL_SALIR → 422 PAGO_AL_SALIR_NO_PERMITIDO.
- El precio y la salida se recalculan en el servidor con `reglas`; no se confía en el cliente.
- El descuento queda como cargo DESCUENTO aparte, con quién lo dio.
- Idempotency-Key: repetir la solicitud no duplica la estadía ni el pago (tabla solicitudes_idempotentes).
- Todo ocurre en una sola transacción.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /estadias y GET /estadias y /estadias/{id} cumplen el contrato.
- [ ] Pasan los escenarios de la regla «RN-06, RN-16, FR-05 — Registro de la entrada», salvo el de transferencia (ticket 05).
- [ ] Los documentos se muestran enmascarados (••••678) en la PWA y en la API.
- [ ] Asistente de 3 pasos en la PWA, como en el prototipo.

## Módulos a tocar
estadías, privacidad (autorizaciones), cobros (pago en efectivo), habitaciones (pasar a OCUPADA), PWA (asistente de entrada).

## Verificación
`npm test -- --test-name-pattern="RN-06|RN-16|FR-05|idempotencia" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
