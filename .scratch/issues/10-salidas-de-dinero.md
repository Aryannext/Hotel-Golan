# 10: Salidas de dinero de la caja

**ID:** TICKET-10
**Requisitos:** FR-12; RN-10, RN-14 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Desde la caja, «Salió plata»: compra para el hotel, retiro de la administración, recargo de aseo entregado a quien limpió u otro, con detalle y valor. El «debe haber» baja y no cuenta como venta.

**Blocked by:** TICKET-03 (Recibir el turno y ver la caja)

**Status:** done (16-10-2026)

## Invariantes de negocio
- DEVOLUCION no se crea desde aquí (solo desde el ticket 09).
- Valor > 0 y detalle obligatorio; registrado en el turno ABIERTO.
- La sección 1 de la vitrina (de la familiar) no es una salida de caja: es otro dinero (segunda entrega).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] GET y POST /movimientos_caja cumplen el contrato.
- [x] Pasa el escenario «Una salida de dinero baja la caja, pero no cuenta como venta» (234.500 − 10.000 = 224.500).

## Módulos a tocar
caja (movimientos), PWA (botón «Salió plata» y lista del turno).

## Verificación
`npm test -- --test-name-pattern="FR-12|salida de dinero" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- `caja/movimientos.ts`: `GET /movimientos_caja` (por defecto, las del turno activo; filtro por turno) y `POST /movimientos_caja` en el turno ABIERTO, con auditoría (tipo y valor, sin el texto libre), evento `caja.movimiento` e Idempotency-Key. DEVOLUCION no se acepta aquí.
- 8 pruebas: 401; compra de $10.000 → «debe haber» 234.500 → 224.500 con el efectivo en 26.000; recargo de aseo con habitación (sin ella, 400); retiro de la administración; DEVOLUCION, valor cero, detalle corto y campos de más → 400; idempotencia; listado en orden y por turno; 409 SIN_TURNO_ABIERTO.
- Decisiones de diseño [P]: el recargo de aseo pide la habitación que se limpió; no se bloquea una salida mayor que el «debe haber» (la PWA advierte «No alcanza la caja»), porque el conteo real puede diferir.
- PWA: botón «Salió plata» en la caja (tipo, habitación si es recargo con $20.000 sugeridos, detalle, valor y cuánto queda) y lista «Lo de este turno» con cobros y salidas por hora; las transferencias marcan «no entra a la caja». Lógica de presentación probada (2 pruebas).
- Probado en el navegador contra Docker: compra «2 jabones» de $10.000 → $224.500; recargo de aseo de la 207 en celular → $204.500, con validación del detalle. Datos sintéticos restaurados con `npm run db:reiniciar`.
- Nota de prueba: el reloj de prueba avanza un minuto por registro para que el orden por hora sea real (con la hora fija, el desempate era al azar).
- `npm test`: 189 pruebas en verde (179 anteriores + 8 de salidas + 2 de presentación); tipos limpios.
