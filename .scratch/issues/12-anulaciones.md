# 12: Anulaciones (administración)

**ID:** TICKET-12
**Requisitos:** FR-17; FR-20 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La administradora anula un cobro o una salida de dinero mal registrados, con motivo. El registro sigue visible y marcado como anulado, y la caja y la cuenta se recalculan.

**Blocked by:** TICKET-06 (Cargos y pagos en la cuenta de la habitación), TICKET-10 (Salidas de dinero de la caja)

**Status:** ready-for-agent

## Invariantes de negocio
- Solo ADMINISTRACION; motivo de 5 caracteres o más; nada se borra (CHECK en el esquema).
- Un pago anulado deja de sumar a la caja y a la cuenta.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /pagos/{id}/anulacion y POST /movimientos_caja/{id}/anulacion cumplen el contrato.
- [ ] La auditoría registra ANULAR con el usuario.

## Módulos a tocar
cobros, caja, auditoría, PWA (botón anular solo para la administración).

## Verificación
`npm test -- --test-name-pattern="FR-17|anula" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
