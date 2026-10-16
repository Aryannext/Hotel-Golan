# 06: Cargos y pagos en la cuenta de la habitación

**ID:** TICKET-06
**Requisitos:** FR-06, FR-07 (abonos); RN-06, RN-14, RN-18 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Desde la ficha de la habitación se agregan varios productos de la nevera, la llave perdida ($40.000) o el recargo de aseo extremo ($20.000) con cantidad. Se registran abonos o pagos, y la cuenta muestra cargos, pagado, por verificar y saldo.

**Blocked by:** TICKET-04 (Registrar una entrada pagada en efectivo)

**Status:** ready-for-agent

## Invariantes de negocio
- Cada cargo guarda precio unitario y cantidad (`valor = valor_unitario × cantidad`); un cambio de precio posterior no lo altera.
- Saldo = cargos − (pagos EN_CAJA y VERIFICADO + POR_VERIFICAR); los RECHAZADO no cuentan.
- Solo se cargan productos activos del catálogo; la vitrina queda para la segunda entrega.
- Selección múltiple de productos, como en el prototipo.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /estadias/{id}/cargos, POST /estadias/{id}/pagos y GET /productos cumplen el contrato.
- [ ] La estadía 211 de la semilla muestra un saldo de $28.000 con $30.000 por verificar.
- [ ] La ficha de la habitación en la PWA tiene «Agregar» y «Registrar pago».

## Módulos a tocar
estadías (cargos), cobros (pagos), configuracion (lectura del catálogo), PWA (ficha de la habitación).

## Verificación
`npm test -- --test-name-pattern="cargos|pagos|cuenta" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
