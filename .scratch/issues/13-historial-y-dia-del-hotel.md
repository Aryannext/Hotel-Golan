# 13: Historial de turnos y resumen por día del hotel

**ID:** TICKET-13
**Requisitos:** FR-16; RN-15 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La administración ve los turnos anteriores (responsable, base, efectivo, transferencias, salidas, pago, contado y diferencia), el detalle de cada uno y un resumen por día del hotel, de 6:30 a. m. a 6:30 a. m.

**Blocked by:** TICKET-11 (Entregar el turno con conteo)

**Status:** done (16-10-2026)

## Invariantes de negocio
- El día del hotel agrupa el turno de día y el de noche siguiente [P aceptada por recepción; falta la aprobación de la administradora].
- Solo ADMINISTRACION.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] GET /turnos, GET /turnos/{id} y GET /reportes/dias cumplen el contrato.
- [x] Pasa el escenario «Resumen del día 12 de octubre» (195.000 + 26.000 = 221.000).

## Módulos a tocar
caja (consultas), reportes, PWA (pestañas de la administración).

## Verificación
`node --test src/api/reportes.test.ts src/web/reportes.test.ts`

`npm test`, `npm run tipos` y `npm run web:build`.

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- API: historial paginado (20 por defecto, máximo 100), orden descendente por inicio e ID; detalle con pagos y movimientos, incluidos los anulados. Las tres consultas requieren ADMINISTRACION.
- Resumen diario: fechas inclusivas, límites horarios en America/Bogota, efectivo y transferencias verificadas/pendientes separados; descuentos, salidas y diferencias sin duplicación por cruces entre tablas. La base no es ingreso. Rechaza fechas inválidas o invertidas.
- Convenciones de implementación [P; FR-16 / RN-15]: se agrupan los turnos recibidos por su inicio en el intervalo [06:30, 06:30 del día siguiente), incluidos los abiertos con cifras parciales. Los turnos por recibir se muestran en el historial, pero no en el resumen. Los días sin turnos recibidos no generan filas. Una entrega anticipada o tardía no divide el turno entre días.
- Los pagos y salidas pertenecen al turno en que se registraron. Una confirmación o anulación posterior actualiza esos totales sin moverlos de día. Los descuentos de entrada pertenecen al turno de la estadía. Las diferencias conservan el conteo guardado al entregar, sin recalcularlo por anulaciones posteriores. El pago del turno se muestra aparte de las salidas de caja, según el modelo existente.
- PWA: pestaña Historial exclusiva de administración; consultas Por turno y Por día, paginación, detalle, rango de fechas, estados vacíos, errores y actualización en vivo/manual. La fecha inicial respeta el corte de las 6:30 aun si el dispositivo está en otra zona horaria.
- TDD: 10 pruebas de API fallaron por ausencia de rutas antes de implementarlas; 3 pruebas de presentación se añadieron antes de crear su módulo. Después, todas pasaron.
- Verificación completa: **251 pruebas en verde** (238 anteriores + 13 nuevas), tipos limpios y compilación de producción correcta. El primer intento aislado bloqueó cuatro conexiones locales de las pruebas SSE (EACCES); la suite completa pasó al permitir la conexión a su servidor local, sin modificar las pruebas.
- Navegador contra la instancia local con datos sintéticos: administración ve historial, detalle de los cuatro pagos de la semilla y resumen del 12/10 ($26.000 efectivo, $55.000 verificados y $30.000 pendientes); recepción solo ve Habitaciones y Caja. El ejemplo de dos turnos con $221.000 se verifica en la prueba de aceptación aislada.
- Sigue pendiente la validación operativa de la administradora sobre el corte del día del hotel; el desarrollo no cambia ese estado.
