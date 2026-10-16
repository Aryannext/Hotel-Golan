# 04: Registrar una entrada pagada en efectivo

**ID:** TICKET-04
**Requisitos:** FR-03, FR-05; RN-06, RN-16, RN-17 (solo validación de disponibilidad) (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La recepcionista completa el asistente: datos del titular (solo el titular; documento opcional; menor con acompañante verificado), casilla «el huésped autorizó» con la versión del aviso, habitación, tarifa y pago en efectivo con vueltas. La habitación queda ocupada y la caja del turno sube.

**Blocked by:** TICKET-02 (Cotizar una estadía (precio y hora de salida)), TICKET-03 (Recibir el turno y ver la caja)

**Status:** done (16-10-2026)

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
- [x] POST /estadias y GET /estadias y /estadias/{id} cumplen el contrato.
- [x] Pasan los escenarios de la regla «RN-06, RN-16, FR-05 — Registro de la entrada», salvo el de transferencia (ticket 05).
- [x] Los documentos se muestran enmascarados (••••678) en la PWA y en la API.
- [x] Asistente de 3 pasos en la PWA, como en el prototipo.

## Módulos a tocar
estadías, privacidad (autorizaciones), cobros (pago en efectivo), habitaciones (pasar a OCUPADA), PWA (asistente de entrada).

## Verificación
`npm test -- --test-name-pattern="RN-06|RN-16|FR-05|idempotencia" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- Módulo `estadias/estadias.ts`: `POST /estadias` (con Idempotency-Key), `GET /estadias` (filtro por estado y paginación) y `GET /estadias/{id}` con cargos, pagos y cuenta. 19 pruebas: entrada en efectivo (cargo 55.000, pago EN_CAJA, habitación OCUPADA, autorización con versión, hora y usuario, caja +55.000), documento enmascarado (••••678) y auditoría sin datos personales, 422 AUTORIZACION_REQUERIDA sin cambios, menor sin acompañante → 400, número sin tipo → 400, pagar al salir con una noche, 422 PAGO_AL_SALIR_NO_PERMITIDO (varias noches y tres horas), 409 HABITACION_NO_DISPONIBLE (ocupada y en limpieza), dos entradas a la vez → una sola, descuento como cargo aparte, abono en efectivo, Nequi POR_VERIFICAR, idempotencia (misma estadía, un solo pago; otra persona con la misma clave → 409), consultas y 409 SIN_TURNO_ABIERTO.
- `comun/idempotencia.ts`: guarda la respuesta en `solicitudes_idempotentes` en la misma transacción; si dos envíos chocan, devuelve la del primero.
- Adaptador PGlite de pruebas: serializa las transacciones (antes dos transacciones simultáneas se mezclaban en la única conexión).
- Decisiones de diseño [P]: Nequi y Bancolombia ya crean el pago POR_VERIFICAR con su evento `pago.por_verificar` (la verificación y el aviso en vivo siguen en el TICKET-05); el registro tardío responde 400 hasta el TICKET-18; el efectivo recibido de más son vueltas y el de menos queda como abono; la versión del aviso (AV-2026-10) va fija en la PWA hasta que haya configuración.
- PWA: asistente de 3 pasos (datos del titular con casilla de autorización y menor con acompañante, habitación y servicio, confirmar con resumen, medio de pago y vueltas). La clave de idempotencia se genera una vez por asistente, con respaldo si la conexión no es segura. 7 pruebas de lógica de presentación.
- Probado en el navegador contra Docker: 206, 2 personas, efectivo $60.000 → vueltas $5.000, documento CC ••••432; la habitación quedó ocupada y la caja pasó de $234.500 a $289.500. Vista de celular sin desbordes. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 132 pruebas en verde (107 anteriores + 19 de estadías + 6 de presentación); tipos limpios.
