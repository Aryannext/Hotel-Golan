# 08: Dar salida y revisar la habitación

**ID:** TICKET-08
**Requisitos:** FR-09, FR-02; RN-07 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La recepcionista da la salida solo si la cuenta está en $0; si no, el sistema le ofrece cobrar el saldo. La habitación pasa a «Por revisar»; quien revisa la manda a limpieza normal o especial, o a mantenimiento; al terminar la limpieza queda disponible.

**Blocked by:** TICKET-06 (Cargos y pagos en la cuenta de la habitación)

**Status:** done (16-10-2026)

## Invariantes de negocio
- Saldo > 0 → 409 SALDO_PENDIENTE; nadie sale debiendo.
- Transiciones válidas: POR_REVISAR → LIMPIEZA | MANTENIMIENTO; LIMPIEZA → DISPONIBLE; MANTENIMIENTO → POR_REVISAR; OCUPADA solo al crear una estadía.
- La limpieza especial recuerda el recargo de $20.000 (RN-14).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] POST /estadias/{id}/salida y PUT /habitaciones/{numero}/estado cumplen el contrato.
- [x] Pasan los escenarios de la regla «RN-07 — Nadie sale debiendo».
- [x] Una transición inválida responde 409 TRANSICION_INVALIDA.

## Módulos a tocar
estadías (salida), habitaciones (transiciones), PWA (dar salida y revisar).

## Verificación
`npm test -- --test-name-pattern="RN-07|FR-02|transici" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- `POST /estadias/{id}/salida` (en `estadias/estadias.ts`): con saldo, 409 SALDO_PENDIENTE con el valor que falta; con la cuenta en $0, la estadía queda CERRADA con la hora real y la habitación POR_REVISAR («Salió a las …»), con auditoría y eventos `estadia.cerrada` y `habitacion.actualizada`.
- `PUT /habitaciones/{numero}/estado` (en `habitaciones/rutas.ts`): solo las transiciones de FR-02 (POR_REVISAR → LIMPIEZA o MANTENIMIENTO; LIMPIEZA → DISPONIBLE; MANTENIMIENTO → POR_REVISAR); lo demás responde 409 TRANSICION_INVALIDA. `limpieza_especial` solo va con LIMPIEZA. Deja nota, auditoría y evento.
- 11 pruebas: 401, salida bloqueada (211, $28.000), salida al día (205), ya cerrada → 409, inexistente → 404, salida con transferencia por verificar, por revisar no se asigna, limpieza especial → disponible, limpieza normal, mantenimiento → por revisar, transiciones inválidas y 400.
- Decisiones de diseño [P]: una transferencia por verificar cuenta como pagada para salir (la habitación se entrega igual, RN-12); la limpieza especial solo deja la nota y el recordatorio del recargo de $20.000, porque el cobro al huésped va como cargo (TICKET-06) y la entrega a quien limpió como salida de caja (TICKET-10).
- PWA: «Dar salida» en la ficha (resumen, «Cobrar» si hay saldo y botón bloqueado hasta que la cuenta esté en $0) y panel de estado para las habitaciones por revisar, en limpieza o en mantenimiento (limpieza normal o especial, daño con nota, «Limpia y revisada», «Ya está arreglada»). Lógica de presentación probada (1 prueba).
- Probado en el navegador contra Docker: 211 con salida bloqueada → cobro de $28.000 → salida → por revisar → limpieza especial (con el recordatorio del recargo) → disponible; 207 a mantenimiento con la nota del daño. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 179 pruebas en verde (167 anteriores + 11 de salida y revisión + 1 de presentación); tipos limpios.
