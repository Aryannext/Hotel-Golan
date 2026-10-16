# 17: Anonimizar los datos de huéspedes a los 90 días

**ID:** TICKET-17
**Requisitos:** FR-21; RN-16; ADR-006 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Una tarea diaria borra nombre, documento y teléfono de los huéspedes cuya estadía terminó hace más de `retencion_datos_dias` (90). Se conservan importes y movimientos; en pantalla aparece «Huésped anonimizado».

**Blocked by:** TICKET-04 (Registrar una entrada pagada en efectivo)

**Status:** ready-for-agent

## Invariantes de negocio
- CHECK del esquema: un huésped anonimizado no conserva nombre, documento ni teléfono.
- La auditoría registra ANONIMIZAR sin el dato borrado.
- Los 90 días son una interpretación [P/V] que debe confirmar la administradora; el valor es configurable.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] Pasa el escenario «Anonimizar a los 90 días» (salida el 10-07-2026, tarea el 09-10-2026).
- [ ] La tarea es idempotente: correrla dos veces no falla ni duplica la auditoría.

## Módulos a tocar
privacidad, tareas programadas, auditoría.

## Verificación
`npm test -- --test-name-pattern="FR-21|anonimiza" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
