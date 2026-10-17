# 23: Lavandería para huéspedes

**ID:** TICKET-23
**Requisitos:** FR-27; RN-22, RN-07 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** Recepción registra un pedido de lavandería (prendas y cantidades) para una habitación ocupada; el lavado se carga a su cuenta. Una lista muestra los pedidos por entregar. Al entregar la ropa se cobra; si no paga, solo se entrega con la autorización del recepcionista, que queda registrada, y la deuda sigue en la cuenta.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Invariantes de negocio
- Precios del grupo Lavandería del catálogo (editables por la administración, RN-19).
- Estados del pedido: RECIBIDO → ENTREGADO. Entregar sin pago exige marcar «autorizo entregar sin pago» y deja quién autorizó.
- Nadie sale debiendo (RN-07): la salida sigue bloqueada mientras haya saldo.
- Lo que el hotel le cobre al recepcionista por una deuda es laboral: el sistema no lo calcula (SOW §5.3).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] Un pedido de 2 busos y 1 pantalón para la 205 crea un cargo de $7.000 en su cuenta.
- [ ] El pedido aparece en «Lavandería por entregar» hasta que se entrega.
- [ ] Entregar cobrando registra el pago; entregar sin pago solo es posible con la autorización marcada y queda en la auditoría con el nombre del recepcionista.
- [ ] Con la deuda pendiente, «Dar salida» sigue bloqueado.

## Módulos a tocar
nuevo módulo de lavandería, cargos, pagos, PWA (ficha y lista de pedidos).

## Verificación
`npm test -- --test-name-pattern="FR-27|lavander" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
