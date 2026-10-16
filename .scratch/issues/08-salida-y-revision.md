# 08: Dar salida y revisar la habitación

**ID:** TICKET-08
**Requisitos:** FR-09, FR-02; RN-07 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La recepcionista da la salida solo si la cuenta está en $0; si no, el sistema le ofrece cobrar el saldo. La habitación pasa a «Por revisar»; quien revisa la manda a limpieza normal o especial, o a mantenimiento; al terminar la limpieza queda disponible.

**Blocked by:** TICKET-06 (Cargos y pagos en la cuenta de la habitación)

**Status:** ready-for-agent

## Invariantes de negocio
- Saldo > 0 → 409 SALDO_PENDIENTE; nadie sale debiendo.
- Transiciones válidas: POR_REVISAR → LIMPIEZA | MANTENIMIENTO; LIMPIEZA → DISPONIBLE; MANTENIMIENTO → POR_REVISAR; OCUPADA solo al crear una estadía.
- La limpieza especial recuerda el recargo de $20.000 (RN-14).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /estadias/{id}/salida y PUT /habitaciones/{numero}/estado cumplen el contrato.
- [ ] Pasan los escenarios de la regla «RN-07 — Nadie sale debiendo».
- [ ] Una transición inválida responde 409 TRANSICION_INVALIDA.

## Módulos a tocar
estadías (salida), habitaciones (transiciones), PWA (dar salida y revisar).

## Verificación
`npm test -- --test-name-pattern="RN-07|FR-02|transici" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
