# 05: Transferencia por verificar y confirmación en tiempo real

**ID:** TICKET-05
**Requisitos:** FR-07 (transferencias), FR-15; RN-12; ADR-005, ADR-011 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Si el cliente paga por Nequi o Bancolombia, el pago queda «por verificar» y la habitación se entrega igual. La administradora o la dueña ven en su inicio «Pagos por confirmar» y tocan «Llegó» o «No llegó»; la pantalla de recepción cambia sola, sin recargar.

**Blocked by:** TICKET-04 (Registrar una entrada pagada en efectivo)

**Status:** ready-for-agent

## Invariantes de negocio
- El efectivo siempre es EN_CAJA; una transferencia empieza POR_VERIFICAR (CHECK ya en el esquema).
- Solo ADMINISTRACION verifica (403 para recepción); un pago ya verificado → 409.
- NO_LLEGO → RECHAZADO y el saldo de la estadía vuelve a subir.
- El evento se escribe en `eventos_salida` en la misma transacción (Outbox); GET /eventos lo entrega por SSE con Last-Event-ID; el cliente hace consulta periódica cada 30 s como respaldo.
- Reutilizar la regla de `scripts/lib/verificacion.ts` (Inbox/Outbox ya probados).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] GET /pagos, POST /pagos/{id}/verificacion y GET /eventos cumplen el contrato.
- [ ] Pasan los escenarios de la regla «RN-12, FR-15»: el evento llega a recepción en menos de 5 s.
- [ ] En la PWA de la administración, la tarjeta «Pagos por confirmar» funciona desde un celular de 360 px.

## Módulos a tocar
cobros (verificación), tiempo_real (publicador del outbox + SSE), PWA (inicio de administración y actualización en vivo).

## Verificación
`npm test -- --test-name-pattern="RN-12|FR-15|SSE" && npm run tipos; manual: abrir dos navegadores (recepción y administración).`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
