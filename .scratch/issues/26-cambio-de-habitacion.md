# 26: Cambio de habitación

**ID:** TICKET-26
**Requisitos:** FR-30; RN-17, RN-02, RN-07 (docs/PRD.md v0.5; fuente: HG-ACT-001 02.07; auditoría HG-AUD-001, H-01 y H-06)

**What to build:** Desde la ficha de una habitación ocupada, recepción pasa la estadía a otra habitación disponible, antes de las 12:00 m. La cuenta (cargos, pagos y saldo) sigue con la estadía. La habitación que deja pasa a «Por revisar» y la nueva queda ocupada. El mapa se actualiza en vivo. Si cambia el tipo (ventilador ↔ aire), la diferencia de tarifa se aplica según lo que decida la administradora. De paso, «Dar salida» avisa si el huésped tiene ropa en lavandería sin entregar.

**Blocked by:** None (can start immediately). Antes de construir, confirmar las decisiones [V] de abajo con la administradora (HG-VAL-001, tema 2).

**Status:** needs-info

## Decisiones por confirmar [V]
- **Precio entre tipos.** Propuesta [P] mientras no responda:
  - de ventilador a aire se carga la diferencia de las noches que faltan (tarifa vigente según personas);
  - de aire a ventilador no se devuelve nada.
- **Habitación que deja.** Propuesta [P]: pasa a «Por revisar», igual que tras una salida (FR-02).
- **Quién autoriza.** Propuesta [P]: recepción, sin autorización adicional.
- **Hora límite.** La regla dice «antes de las 12» (02.07). Falta saber si eso vale para cualquier día de la estadía o solo para el de salida.

## Invariantes de negocio
- Solo antes de las 12:00 m. (America/Bogota); después, 409 con un mensaje claro (RN-17).
- La habitación destino debe estar Disponible (FR-02); no se puede pasar a la misma habitación.
- La salida prevista no cambia por el cambio de habitación.
- La diferencia de tarifa es un cargo aparte, con quién lo registró. Nada de dinero se borra (ADR-008).
- Cada cambio queda en la auditoría con usuario, hora, habitación de origen y de destino, sin datos personales (FR-20).
- El aviso de ropa en lavandería al dar salida informa, pero no bloquea (H-06).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).

## Criterios de aceptación
- [ ] A las 10:00 a. m., la estadía de la 205 pasa a la 207 (disponible): la 207 queda ocupada con la misma cuenta y la 205 pasa a «Por revisar».
- [ ] A las 12:01 p. m., el cambio se rechaza (409) y nada cambia.
- [ ] A una habitación ocupada, en limpieza o en mantenimiento: 409.
- [ ] De ventilador a aire, la diferencia queda como cargo según la decisión de la administradora, y el saldo se recalcula.
- [ ] El mapa de otro usuario muestra el cambio sin recargar.
- [ ] La auditoría muestra «Cambió la habitación 205 a la 207».
- [ ] «Dar salida» muestra «Tiene ropa en lavandería por entregar» cuando hay un pedido recibido sin entregar.

## Módulos a tocar
estadías (cambio de habitación), habitaciones (estados), tiempo real, auditoría, PWA (ficha y salida), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="RN-17|cambio de habitación" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
