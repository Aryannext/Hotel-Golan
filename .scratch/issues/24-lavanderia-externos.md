# 24: Lavandería para externos

**ID:** TICKET-24
**Requisitos:** FR-27; RN-22, RN-20 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** Recepción registra un pedido de lavandería para una persona que no está hospedada, anotando solo su nombre. Puede pagar por adelantado o al reclamar. Sin pago no se entrega, salvo con la autorización registrada del recepcionista; la deuda queda a nombre de esa persona y con quien la autorizó.

**Blocked by:** TICKET-22 (Venta de contado), TICKET-23 (Lavandería para huéspedes)

**Status:** ready-for-agent

## Invariantes de negocio
- Solo el nombre de la persona externa (T4-4): sin documento ni teléfono. Ese nombre se anonimiza con la misma política de los huéspedes (90 días, RN-16) [P/V].
- Los pagos usan los pagos sin habitación del TICKET-22: el efectivo va a la caja del turno y la transferencia queda «por verificar».
- Las deudas de externos se ven en una lista para la administración.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] Un pedido externo pagado por adelantado en efectivo suma a la caja y queda por entregar.
- [ ] Un pedido externo sin pagar no se entrega sin la autorización; con ella queda como deuda con el nombre y el recepcionista.
- [ ] La administración ve las deudas de lavandería de externos.
- [ ] El nombre del externo se borra con la tarea de anonimización.

## Módulos a tocar
lavandería, cobros, privacidad (anonimización), PWA.

## Verificación
`npm test -- --test-name-pattern="FR-27|externo" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
