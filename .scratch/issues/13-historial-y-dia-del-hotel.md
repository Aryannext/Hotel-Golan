# 13: Historial de turnos y resumen por día del hotel

**ID:** TICKET-13
**Requisitos:** FR-16; RN-15 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La administración ve los turnos anteriores (responsable, base, efectivo, transferencias, salidas, pago, contado y diferencia), el detalle de cada uno y un resumen por día del hotel, de 6:30 a. m. a 6:30 a. m.

**Blocked by:** TICKET-11 (Entregar el turno con conteo)

**Status:** ready-for-agent

## Invariantes de negocio
- El día del hotel agrupa el turno de día y el de noche siguiente [P aceptada por recepción; falta la aprobación de la administradora].
- Solo ADMINISTRACION.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] GET /turnos, GET /turnos/{id} y GET /reportes/dias cumplen el contrato.
- [ ] Pasa el escenario «Resumen del día 12 de octubre» (195.000 + 26.000 = 221.000).

## Módulos a tocar
caja (consultas), reportes, PWA (pestañas de la administración).

## Verificación
`npm test -- --test-name-pattern="RN-15|reporte" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
