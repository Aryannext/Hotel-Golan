# 26: Cambio de habitación

**ID:** TICKET-26
**Requisitos:** FR-30; RN-17, RN-01, RN-02, RN-07 (docs/PRD.md v0.6; fuente: HG-ACT-001 02.07 y §11 V5-03 a V5-05; auditoría HG-AUD-001, H-01 y H-06)

**What to build:** Desde la ficha de una habitación ocupada, recepción pasa la estadía a otra habitación disponible. La cuenta (cargos, pagos y saldo) sigue con la estadía. La habitación que deja pasa a «Por revisar» y la nueva queda ocupada. El mapa se actualiza en vivo. Cuánto se cobra depende de cuándo se pide el cambio (reglas de la administradora, abajo). De paso, «Dar salida» avisa si el huésped tiene ropa en lavandería sin entregar.

**Blocked by:** None (can start immediately).

**Status:** done

## Reglas confirmadas por la administradora (18-10-2026)
| Caso | Qué se hace |
|---|---|
| Cambia de opinión **a los pocos minutos de entrar**, sin haber usado la habitación | Se cambia a cualquier hora. A una más cara, paga la diferencia. A una más barata, se le devuelve la diferencia (V5-03, V5-05). |
| **Ya durmió o usó** la habitación, y es **antes de las 12:00 m.** | Se cambia, pero se cobra la habitación nueva completa, como una noche nueva. La salida se recalcula con RN-01 desde la hora del cambio [P] (V5-04). |
| Ya pasaron los pocos minutos y es **después de las 12:00 m.** | No se hace el cambio: 409 con un mensaje claro (02.07, V5-03). |

- **«Pocos minutos»:** la administradora dijo «3 o 5». Se guarda como regla configurable en Ajustes, `minutos_cambio_sin_cargo`, con 5 por omisión [P/V].
- **La diferencia** se calcula con la tarifa vigente de cada tipo para las mismas personas y noches. Si es a favor del huésped, se le devuelve como en el desistimiento: en efectivo sale de la caja, ligada a la estadía; si pagó por transferencia, lo decide la administración (RN-08) [P].
- **Al construir:** como la base no admite cargos negativos fuera de los descuentos, en el caso de los pocos minutos el alojamiento anterior se **anula con motivo** y se carga el de la nueva habitación. La devolución en efectivo queda en `movimientos_caja.estadia_id` (migración 0007), y la cuenta la descuenta de lo pagado (`devuelto`).
- **La habitación que deja** pasa a «Por revisar», como tras una salida (FR-02) [P].

## Invariantes de negocio
- La habitación destino debe estar Disponible (FR-02); no se puede pasar a la misma habitación.
- La diferencia o la noche nueva son cargos aparte, con quién los registró. Una devolución nunca pasa de lo pagado. Nada de dinero se borra (ADR-008).
- Cada cambio queda en la auditoría con usuario, hora, habitación de origen y de destino, y valor, sin datos personales (FR-20).
- El aviso de ropa en lavandería al dar salida informa, pero no bloquea (H-06).
- Reglas evaluadas en America/Bogota. Solo datos sintéticos en pruebas.

## Criterios de aceptación
- [x] Entra a la 205 (ventilador) a las 3:00 p. m. y a los 3 minutos pasa a la 201 (aire): paga la diferencia de tarifa, la 201 queda ocupada y la 205 por revisar.
- [x] Entra a la 201 (aire) y a los 3 minutos pasa a la 205 (ventilador): se le devuelve la diferencia.
- [x] Durmió en la 205 y a las 10:00 a. m. pasa a la 207: se cobra una noche nueva de la 207 y la salida se recalcula.
- [x] Durmió en la 205 y pide el cambio a las 12:01 p. m.: 409, nada cambia.
- [x] A una habitación ocupada, en limpieza o en mantenimiento: 409.
- [x] `minutos_cambio_sin_cargo` se edita en Ajustes y se respeta.
- [x] El mapa de otro usuario muestra el cambio sin recargar; la auditoría dice «Cambió la habitación 205 a la 207».
- [x] «Dar salida» muestra «Tiene ropa en lavandería por entregar» cuando hay un pedido recibido sin entregar.

## Módulos a tocar
estadías (cambio de habitación y cotización del cambio), reglas (`minutos_cambio_sin_cargo`), habitaciones (estados), tiempo real, auditoría, PWA (ficha, salida y Ajustes), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="RN-17|cambio de habitación" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
