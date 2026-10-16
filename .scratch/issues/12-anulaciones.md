# 12: Anulaciones (administración)

**ID:** TICKET-12
**Requisitos:** FR-17; FR-20 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La administradora anula un cobro o una salida de dinero mal registrados, con motivo. El registro sigue visible y marcado como anulado, y la caja y la cuenta se recalculan.

**Blocked by:** TICKET-06 (Cargos y pagos en la cuenta de la habitación), TICKET-10 (Salidas de dinero de la caja)

**Status:** done (16-10-2026)

## Invariantes de negocio
- Solo ADMINISTRACION; motivo de 5 caracteres o más; nada se borra (CHECK en el esquema).
- Un pago anulado deja de sumar a la caja y a la cuenta.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] POST /pagos/{id}/anulacion y POST /movimientos_caja/{id}/anulacion cumplen el contrato.
- [x] La auditoría registra ANULAR con el usuario.

## Módulos a tocar
cobros, caja, auditoría, PWA (botón anular solo para la administración).

## Verificación
`npm test -- --test-name-pattern="FR-17|anula" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- `cobros/anulaciones.ts`: `POST /pagos/{id}/anulacion` y `POST /movimientos_caja/{id}/anulacion`, solo para ADMINISTRACION. El motivo debe tener 5 caracteres o más. Guarda `anulado_en`, `anulado_por` y el motivo sin borrar nada; lo ya anulado responde 409 y lo que no existe, 404. La auditoría ANULAR guarda el usuario y el valor (no el texto libre). Emite eventos `habitacion.actualizada` o `caja.movimiento` para que las pantallas se recalculen en vivo.
- 6 pruebas: cobro en efectivo anulado (sigue en la lista, la caja baja $4.000, la cuenta sube $4.000, auditado por admin); transferencia por verificar anulada sale de «por confirmar»; salida anulada (el «debe haber» sube $10.000); recepción → 403; motivo corto 400, ya anulado 409, inexistente 404; la salida de una devolución → 409.
- Decisión de diseño [P]: la salida ligada a una devolución no se anula por aquí, para no dejar la devolución sin su salida de caja.
- PWA: botón «Anular» (papelera) solo para la administración, en «Lo de este turno» y en los pagos de la ficha de la habitación, con un panel que pide el motivo. Lo anulado se ve tachado con la etiqueta «Anulado». 1 prueba de lógica.
- Probado en el navegador contra Docker: como administradora, anulé el cobro de $4.000 de la 211 → aviso «Anulado: …», la caja bajó de $234.500 a $230.500 y la línea siguió visible como anulada; como recepción, no aparece ningún botón «Anular» y se ve el mismo resultado. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 238 pruebas en verde (231 anteriores + 6 de anulaciones + 1 de presentación); tipos limpios.
