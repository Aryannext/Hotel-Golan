# 21: Surtido y existencias

**ID:** TICKET-21
**Requisitos:** FR-25; RN-21 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** La administración anota lo que llega de la vitrina y la nevera (producto, cantidad y fecha) y ve, por producto, lo que llegó, lo vendido y lo que debería quedar. Cada cargo de producto a una habitación descuenta su cantidad. Si un producto queda en 0 o menos, aparece un aviso.

**Blocked by:** TICKET-20 (Catálogo completo en Ajustes)

**Status:** ready-for-agent

## Invariantes de negocio
- Existencias calculadas (T4-12): surtido − cargos de producto vigentes − ventas de contado vigentes (TICKET-22). Sin conteo manual en el relevo.
- Un cargo o una venta anulados devuelven su cantidad.
- Con 0 o menos se avisa, pero no se bloquea la venta [P].
- Lavandería, llave y recargos no tienen existencias.
- Solo ADMINISTRACION registra el surtido y ve las existencias.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] Tras surtir 10 unidades y cargar 3 a una habitación, el producto muestra 7.
- [ ] Anular uno de esos cargos lo devuelve: muestra 8.
- [ ] Un producto en 0 o menos aparece en la campana de avisos de la administración.
- [ ] El surtido queda en la auditoría con quién lo registró; recepción recibe 403.

## Módulos a tocar
configuracion o nuevo módulo de inventario, cargos, avisos, PWA (Ajustes).

## Verificación
`npm test -- --test-name-pattern="FR-25|existencias|surtido" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
