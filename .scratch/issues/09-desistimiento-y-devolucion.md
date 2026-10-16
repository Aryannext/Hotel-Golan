# 09: Desistimiento y devolución

**ID:** TICKET-09
**Requisitos:** FR-10; RN-08 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Si el huésped se arrepiente, la recepcionista registra el motivo: «solo miró» devuelve todo; «ya la usó» no devuelve nada. Si pagó en efectivo, la devolución sale de la caja; si pagó por transferencia sin confirmar, el sistema pide esperar a la administración.

**Blocked by:** TICKET-05 (Transferencia por verificar y confirmación en tiempo real)

**Status:** done (16-10-2026)

## Invariantes de negocio
- Una sola devolución por estadía (UNIQUE en el esquema); nunca más de lo pagado.
- YA_USO → valor 0. Transferencia POR_VERIFICAR → 409 PAGO_SIN_VERIFICAR.
- En efectivo crea un movimiento de caja DEVOLUCION ligado; el medio TRANSFERENCIA lo decide la administración.
- La estadía queda DESISTIDA y la habitación POR_REVISAR.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] POST /estadias/{id}/devoluciones cumple el contrato.
- [x] Pasan los tres escenarios de la regla «RN-08 — Devolución por desistimiento».

## Módulos a tocar
estadías (devoluciones), caja (movimiento DEVOLUCION), PWA (desiste).

## Verificación
`npm test -- --test-name-pattern="RN-08" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- `estadias/devoluciones.ts`: `POST /estadias/{id}/devoluciones`. Con SOLO_MIRO devuelve todo lo pagado (efectivo y transferencias confirmadas); con YA_USO, $0. Si hay una transferencia por verificar, responde 409 PAGO_SIN_VERIFICAR. Si pagó por transferencia o pide el medio TRANSFERENCIA, solo la administración puede registrarla (403 para recepción). En efectivo crea el movimiento de caja DEVOLUCION ligado (requiere turno abierto). La estadía queda DESISTIDA con su hora y la habitación POR_REVISAR («Desistió a las …»). Deja auditoría, eventos e Idempotency-Key; una sola devolución por estadía (UNIQUE y estadía ya no activa → 409).
- 8 pruebas: los tres escenarios de RN-08 (solo miró en efectivo con su movimiento y la caja igual que antes; ya la usó → 0 sin movimiento; transferencia sin verificar → 409), transferencia confirmada (recepción 403, administración por transferencia sin movimiento), recepción no elige transferencia, una sola devolución e idempotencia, pago al salir sin pagos → 0, y 404/400.
- Decisión de diseño [P]: lo pagado por transferencia ya confirmada lo devuelve la administración (RN-08: «la administración decide el medio»); recepción solo devuelve efectivo.
- PWA: «Desiste» en la ficha de la habitación (motivo, valor a devolver, medio solo para la administración, bloqueo con explicación si falta verificar o si le toca a la administración). 4 pruebas de lógica.
- Probado en el navegador contra Docker: entrada de $45.000 en efectivo en la 206 → «Solo la miró» → se devolvieron $45.000 de la caja (movimiento DEVOLUCION), la caja volvió a $234.500 y la 206 quedó por revisar; en la 211 (Bancolombia por verificar) el botón queda bloqueado con la explicación. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 231 pruebas en verde (227 con las 8 de devolución + 4 de presentación); tipos limpios.
