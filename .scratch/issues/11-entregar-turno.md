# 11: Entregar el turno con conteo

**ID:** TICKET-11
**Requisitos:** FR-13; RN-09, RN-11 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Al terminar su horario, la recepcionista que tiene el turno indica si tomó su pago ($70.000 de día o $50.000 de noche), cuenta el efectivo y, si no cuadra, escribe el motivo. El turno se cierra, el siguiente queda «por recibir» con lo contado y se cierra su sesión.

**Blocked by:** TICKET-10 (Salidas de dinero de la caja)

**Status:** done (16-10-2026)

## Invariantes de negocio
- Solo RECEPCION y solo el responsable del turno; la administración → 403.
- Esperado = «debe haber» − pago del turno (si lo tomó). Conteo obligatorio; diferencia sin motivo → 422 MOTIVO_REQUERIDO (también CHECK en la base).
- La diferencia se registra con su responsable; el sistema no descuenta nada de nómina.
- Aviso si se entrega más de 60 minutos antes del fin programado (6:30 a. m. o 6:30 p. m.).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] POST /turnos/actual/entrega cumple el contrato.
- [x] Pasan «Entrega que cuadra» ($184.500), «Entrega que no cuadra exige motivo» y «La administración no entrega turnos».
- [x] La PWA reproduce el flujo del prototipo: pregunta por el pago, conteo y motivo.

## Módulos a tocar
caja (entrega), identidad (cerrar sesión), PWA (entregar turno).

## Verificación
`npm test -- --test-name-pattern="RN-11|entrega" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- `POST /turnos/actual/entrega` (en `caja/turnos.ts`): solo RECEPCION y solo quien tiene el turno (403 en otro caso). Esperado = «debe haber» − pago del turno si lo tomó. Si la diferencia no tiene motivo, responde 422 MOTIVO_REQUERIDO. En una sola transacción: cierra el turno, crea el siguiente (día ↔ noche) POR_RECIBIR con lo contado y su pago, deja auditoría ENTREGAR_TURNO, emite `turno.entregado` (y `turno.diferencia` si no cuadra) y cierra la sesión de quien entrega (borra la cookie). La respuesta trae el `cierre` del contrato.
- 9 pruebas: 401; entrega que cuadra ($184.500, siguiente de día por recibir con $184.500 y pago $70.000); cierre de la sesión; no cuadra sin motivo → 422 y con motivo → −4.500; sin tomar el pago → $234.500; administración → 403; otra recepcionista → 403; sin turno abierto → 409 y 400; ciclo completo entrega → recepción.
- Decisiones de diseño [P]: el aviso de entregar más de 60 minutos antes lo muestra la PWA con `fin_programado_en` y no bloquea; la entrega no usa Idempotency-Key porque la sesión se cierra en el mismo paso y un reintento encuentra el turno ya cerrado (409).
- PWA: botón «Entregar turno» en la caja, solo para quien tiene el turno, con el flujo del prototipo: pregunta por el pago, muestra «debe dejar», pide el conteo, muestra «Faltan/Sobran» y exige motivo. Al entregar vuelve al inicio de sesión con el mensaje para quien recibe. 2 pruebas de lógica.
- Probado en el navegador contra PostgreSQL de Docker: recepcion2 entregó la noche con $180.000 y el motivo «devolví 4.500 de vueltas a la 205»; recepcion1 entró, vio «recepcion2 le dejó $180.000» y lo recibió con un toque; la caja de día quedó en $180.000 y su pago en $70.000. El aviso «Todavía no es hora del relevo» apareció a las 4 p. m. En la base quedaron el cierre, la diferencia −4.500 y los eventos. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 200 pruebas en verde (189 anteriores + 9 de entrega + 2 de presentación); tipos limpios.
