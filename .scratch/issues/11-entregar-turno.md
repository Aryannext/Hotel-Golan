# 11: Entregar el turno con conteo

**ID:** TICKET-11
**Requisitos:** FR-13; RN-09, RN-11 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Al terminar su horario, la recepcionista que tiene el turno indica si tomó su pago ($70.000 de día o $50.000 de noche), cuenta el efectivo y, si no cuadra, escribe el motivo. El turno se cierra, el siguiente queda «por recibir» con lo contado y se cierra su sesión.

**Blocked by:** TICKET-10 (Salidas de dinero de la caja)

**Status:** ready-for-agent

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
- [ ] POST /turnos/actual/entrega cumple el contrato.
- [ ] Pasan «Entrega que cuadra» ($184.500), «Entrega que no cuadra exige motivo» y «La administración no entrega turnos».
- [ ] La PWA reproduce el flujo del prototipo: pregunta por el pago, conteo y motivo.

## Módulos a tocar
caja (entrega), identidad (cerrar sesión), PWA (entregar turno).

## Verificación
`npm test -- --test-name-pattern="RN-11|entrega" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
