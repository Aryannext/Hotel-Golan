# 18: Registro tardío (contingencia)

**ID:** TICKET-18
**Requisitos:** FR-03 (`registro_tardio`); ADR-010 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Después de un corte de internet o de luz, la recepcionista pasa al sistema lo anotado en el talonario, con la hora real de entrada, marcado como «registro tardío».

**Blocked by:** TICKET-04 (Registrar una entrada pagada en efectivo)

**Status:** ready-for-agent

## Invariantes de negocio
- `entrada_en` solo con `registro_tardio`, y dentro de las últimas 48 horas.
- La salida y el precio se calculan con la hora real de entrada.
- Se ve quién digitó y cuándo.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /estadias acepta `registro_tardio` y `entrada_en` según el contrato.
- [ ] Una prueba con una entrada de hace 3 horas calcula bien la salida.

## Módulos a tocar
estadías, PWA (opción «registro tardío» en el asistente).

## Verificación
`npm test -- --test-name-pattern="tard" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
