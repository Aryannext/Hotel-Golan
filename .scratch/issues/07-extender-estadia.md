# 07: Extender la estadía con la regla de las 4 p. m.

**ID:** TICKET-07
**Requisitos:** FR-08; RN-04 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Si el huésped quiere seguir, la recepcionista elige otra noche, tres horas o por horas. Ve el valor y la nueva salida; si las horas pasan de las 4:00 p. m., el sistema cobra la noche completa en lugar de las horas.

**Blocked by:** TICKET-02 (Cotizar una estadía (precio y hora de salida)), TICKET-06 (Cargos y pagos en la cuenta de la habitación)

**Status:** ready-for-agent

## Invariantes de negocio
- $8.000 por hora empezada, en aire y en ventilador, solo como extensión.
- Extensión que pasa de las 4:00 p. m. → se cobra NOCHE (reemplaza las horas); otra noche suma 24 horas desde la salida actual.
- La extensión se calcula desde la salida actual o desde ahora, lo que sea mayor.
- Sin descuento en las extensiones por hora.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /estadias/{id}/extensiones cumple el contrato.
- [ ] Pasa el esquema «Extender después del mediodía» (1 h $8.000; 4 h $32.000; 5 h → $60.000 hasta mañana a las 12 m.).
- [ ] La PWA advierte «Pasaría de las 4:00 p. m.: se cobra la noche completa».

## Módulos a tocar
reglas (extensión), estadías, PWA (extender).

## Verificación
`npm test -- --test-name-pattern="RN-04" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
