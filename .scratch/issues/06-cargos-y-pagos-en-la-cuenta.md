# 06: Cargos y pagos en la cuenta de la habitación

**ID:** TICKET-06
**Requisitos:** FR-06, FR-07 (abonos); RN-06, RN-14, RN-18 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Desde la ficha de la habitación se agregan varios productos de la nevera, la llave perdida ($40.000) o el recargo de aseo extremo ($20.000) con cantidad. Se registran abonos o pagos, y la cuenta muestra cargos, pagado, por verificar y saldo.

**Blocked by:** TICKET-04 (Registrar una entrada pagada en efectivo)

**Status:** done (16-10-2026)

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
- [x] POST /estadias/{id}/cargos, POST /estadias/{id}/pagos y GET /productos cumplen el contrato.
- [x] La estadía 211 de la semilla muestra un saldo de $28.000 con $30.000 por verificar.
- [x] La ficha de la habitación en la PWA tiene «Agregar» y «Registrar pago».

## Módulos a tocar
estadías (cargos), cobros (pagos), configuracion (lectura del catálogo), PWA (ficha de la habitación).

## Verificación
`npm test -- --test-name-pattern="cargos|pagos|cuenta" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- `configuracion/productos.ts`: `GET /productos` (solo activos). `estadias/cargos.ts`: `POST /estadias/{id}/cargos` con varios productos y cantidad, precio del momento, tipo LLAVE o RECARGO_ASEO según el producto, auditoría por cargo, evento `habitacion.actualizada` e Idempotency-Key. `cobros/pagos.ts`: `POST /estadias/{id}/pagos`; el efectivo queda EN_CAJA y las transferencias POR_VERIFICAR con su evento; exige turno abierto y estadía activa, y no admite más que el saldo.
- 16 pruebas: catálogo e inactivos, cuenta de la 211 ($28.000 con $30.000 por verificar), cargos con cantidad y llave, el precio no cambia después, recargo de aseo auditado, 409/404/400, estadía cerrada → 409, idempotencia de cargos y pagos, abono en efectivo a la caja, Nequi por verificar, pago mayor que el saldo → 409, saldo en cero y 409 SIN_TURNO_ABIERTO.
- Decisiones de diseño [P]: el tipo de cargo se deduce del nombre del producto («Llave…» → LLAVE, «Recargo aseo…» → RECARGO_ASEO), hasta que la configuración (TICKET-15) lo guarde en el catálogo; un pago no puede superar el saldo (lo que sobra son vueltas); la vitrina no se muestra hasta la segunda entrega; la entrega del recargo a quien limpia es una salida de caja (TICKET-10).
- PWA: al tocar una habitación ocupada se abre su ficha (el panel del prototipo) con cargos, pagos, estado del saldo, «Agregar» (selección múltiple con contador) y «Registrar pago» (efectivo con vueltas o transferencia). Lógica de presentación probada (4 pruebas).
- Probado en el navegador contra Docker: 211 con 2 Coca-Cola y la llave → debe $76.000 (también en el mapa); pago en efectivo de $100.000 → vueltas $24.000, se registran $76.000 y la caja pasa a $310.500; la cuenta queda «por verificar» hasta que la administración confirme los $30.000. Vista de celular correcta. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 167 pruebas en verde (147 anteriores + 16 de cuenta + 4 de presentación); tipos limpios.
