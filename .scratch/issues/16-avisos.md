# 16: Avisos en pantalla

**ID:** TICKET-16
**Requisitos:** FR-23; RN-04 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La campana y el inicio muestran salidas vencidas («corre $8.000 por hora»), pagos por verificar y habitaciones por revisar o en limpieza, actualizados en vivo.

**Blocked by:** TICKET-05 (Transferencia por verificar y confirmación en tiempo real), TICKET-08 (Dar salida y revisar la habitación)

**Status:** ready-for-agent

## Invariantes de negocio
- Los avisos no contienen datos personales completos (solo número de habitación y valores).
- Se recalculan con los eventos SSE.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] La PWA muestra los avisos de la semilla (211 con pago por verificar; 207 por revisar).
- [ ] Una salida vencida aparece sin recargar.

## Módulos a tocar
tiempo_real, PWA (campana e inicio).

## Verificación
`npm test -- --test-name-pattern="FR-23|aviso" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
