# 22: Venta de contado

**ID:** TICKET-22
**Requisitos:** FR-26; RN-20, RN-21, RN-10, RN-12 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** Recepción vende productos sin habitación (a quien mira las habitaciones y no se queda, por ejemplo), con cantidades y medio de pago. El efectivo suma a «En la caja debe haber»; una transferencia queda «por confirmar» para la administración; las existencias bajan; la venta aparece en «Lo de este turno» y en el historial, y la administración puede anularla.

**Blocked by:** TICKET-21 (Surtido y existencias)

**Status:** ready-for-agent

## Invariantes de negocio
- Prefactor: hoy cada pago pertenece a una estadía. Los pagos de contado no tienen habitación: el esquema y las consultas de caja, verificación e historial deben aceptarlo sin cambiar lo que ya cuadra.
- Medios: efectivo, Nequi o Bancolombia (T4-14). Transferencia → «por verificar» (RN-12).
- El efectivo de contado es un cobro más del turno (RN-10) y no se mezcla con la sección 1 (fuera del sistema).
- Idempotencia: un doble toque no duplica la venta.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] Una venta en efectivo de $6.000 sube «En la caja debe haber» en $6.000 y aparece en «Lo de este turno».
- [ ] Una venta por Nequi aparece en «Por confirmar» y no suma a la caja hasta que se confirme.
- [ ] Las existencias de los productos vendidos bajan.
- [ ] La administración puede anularla con motivo; la caja y las existencias se recalculan.
- [ ] El historial del turno y el resumen por día incluyen las ventas de contado.

## Módulos a tocar
caja, cobros (pagos y anulaciones), reportes, inventario, tiempo real, PWA (Caja).

## Verificación
`npm test -- --test-name-pattern="FR-26|contado" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
