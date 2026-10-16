# 05: Transferencia por verificar y confirmación en tiempo real

**ID:** TICKET-05
**Requisitos:** FR-07 (transferencias), FR-15; RN-12; ADR-005, ADR-011 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Si el cliente paga por Nequi o Bancolombia, el pago queda «por verificar» y la habitación se entrega igual. La administradora o la dueña ven en su inicio «Pagos por confirmar» y tocan «Llegó» o «No llegó»; la pantalla de recepción cambia sola, sin recargar.

**Blocked by:** TICKET-04 (Registrar una entrada pagada en efectivo)

**Status:** done (16-10-2026)

## Invariantes de negocio
- El efectivo siempre es EN_CAJA; una transferencia empieza POR_VERIFICAR (CHECK ya en el esquema).
- Solo ADMINISTRACION verifica (403 para recepción); un pago ya verificado → 409.
- NO_LLEGO → RECHAZADO y el saldo de la estadía vuelve a subir.
- El evento se escribe en `eventos_salida` en la misma transacción (Outbox); GET /eventos lo entrega por SSE con Last-Event-ID; el cliente hace consulta periódica cada 30 s como respaldo.
- Reutilizar la regla de `scripts/lib/verificacion.ts` (Inbox/Outbox ya probados).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] GET /pagos, POST /pagos/{id}/verificacion y GET /eventos cumplen el contrato.
- [x] Pasan los escenarios de la regla «RN-12, FR-15»: el evento llega a recepción en menos de 5 s.
- [x] En la PWA de la administración, la tarjeta «Pagos por confirmar» funciona desde un celular de 360 px.

## Módulos a tocar
cobros (verificación), tiempo_real (publicador del outbox + SSE), PWA (inicio de administración y actualización en vivo).

## Verificación
`npm test -- --test-name-pattern="RN-12|FR-15|SSE" && npm run tipos; manual: abrir dos navegadores (recepción y administración).`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- `cobros/pagos.ts`: `GET /pagos` (filtros por estado y turno) y `POST /pagos/{id}/verificacion` (solo administración), que reutiliza `scripts/lib/verificacion.ts` (Inbox/Outbox). A la regla se le agregó el reloj inyectable. 8 pruebas: contrato Pago, filtros, «Llegó» → VERIFICADO con `verificado_por` admin y la caja no cambia, «No llegó» → RECHAZADO y el saldo de la 211 sube 30.000, 403 para recepción, 409 (ya verificado o en efectivo), 404, 400 e Idempotency-Key.
- `tiempo_real/eventos.ts`: publicador del outbox (se despierta tras cada cambio y revisa cada segundo de respaldo) y `GET /eventos` por SSE con `Last-Event-ID`. `turno.diferencia` solo llega a la administración y los eventos no llevan datos personales. 4 pruebas con servidor real: 401, `pago.verificado` en menos de 5 s, filtro por rol y reconexión sin perder eventos. Al apagar el servidor se cierran las conexiones abiertas.
- PWA: pestaña «Por confirmar» con contador (inicio de la administración), botones grandes «Llegó» y «No llegó» (este último pide confirmar) y clave de idempotencia por pago. `EventSource` con consulta de respaldo cada 30 s; mapa, caja y lista se refrescan solos. Avisos: «nueva transferencia» para la administración y «llegó / NO llegó» para recepción. Lógica de presentación probada (3 pruebas, incluida «ayer»).
- Probado con dos sesiones (recepción en localhost y administradora en 127.0.0.1, celular de 360 px): «No llegó» en la 211 → recepción vio el aviso a los 59 ms y «debe $58.000» sin recargar; una entrada por Nequi en la 209 apareció sola en «Por confirmar» y «Llegó» avisó a recepción. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 147 pruebas en verde (132 anteriores + 8 de pagos + 4 de SSE + 3 de presentación); tipos limpios.
