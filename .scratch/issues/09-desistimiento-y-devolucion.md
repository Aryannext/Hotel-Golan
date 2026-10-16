# 09: Desistimiento y devolución

**ID:** TICKET-09
**Requisitos:** FR-10; RN-08 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Si el huésped se arrepiente, la recepcionista registra el motivo: «solo miró» devuelve todo; «ya la usó» no devuelve nada. Si pagó en efectivo, la devolución sale de la caja; si pagó por transferencia sin confirmar, el sistema pide esperar a la administración.

**Blocked by:** TICKET-05 (Transferencia por verificar y confirmación en tiempo real)

**Status:** ready-for-agent

## Invariantes de negocio
- Una sola devolución por estadía (UNIQUE en el esquema); nunca más de lo pagado.
- YA_USO → valor 0. Transferencia POR_VERIFICAR → 409 PAGO_SIN_VERIFICAR.
- En efectivo crea un movimiento de caja DEVOLUCION ligado; el medio TRANSFERENCIA lo decide la administración.
- La estadía queda DESISTIDA y la habitación POR_REVISAR.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /estadias/{id}/devoluciones cumple el contrato.
- [ ] Pasan los tres escenarios de la regla «RN-08 — Devolución por desistimiento».

## Módulos a tocar
estadías (devoluciones), caja (movimiento DEVOLUCION), PWA (desiste).

## Verificación
`npm test -- --test-name-pattern="RN-08" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
