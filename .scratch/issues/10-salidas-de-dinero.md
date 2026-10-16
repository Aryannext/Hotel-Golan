# 10: Salidas de dinero de la caja

**ID:** TICKET-10
**Requisitos:** FR-12; RN-10, RN-14 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Desde la caja, «Salió plata»: compra para el hotel, retiro de la administración, recargo de aseo entregado a quien limpió u otro, con detalle y valor. El «debe haber» baja y no cuenta como venta.

**Blocked by:** TICKET-03 (Recibir el turno y ver la caja)

**Status:** ready-for-agent

## Invariantes de negocio
- DEVOLUCION no se crea desde aquí (solo desde el ticket 09).
- Valor > 0 y detalle obligatorio; registrado en el turno ABIERTO.
- La sección 1 de la vitrina (de la familiar) no es una salida de caja: es otro dinero (segunda entrega).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] GET y POST /movimientos_caja cumplen el contrato.
- [ ] Pasa el escenario «Una salida de dinero baja la caja, pero no cuenta como venta» (234.500 − 10.000 = 224.500).

## Módulos a tocar
caja (movimientos), PWA (botón «Salió plata» y lista del turno).

## Verificación
`npm test -- --test-name-pattern="FR-12|salida de dinero" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
