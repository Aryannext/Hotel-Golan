# 18: Registro tardío (contingencia)

**ID:** TICKET-18
**Requisitos:** FR-03 (`registro_tardio`); ADR-010 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Después de un corte de internet o de luz, la recepcionista pasa al sistema lo anotado en el talonario, con la hora real de entrada, marcado como «registro tardío».

**Blocked by:** TICKET-04 (Registrar una entrada pagada en efectivo)

**Status:** done

## Invariantes de negocio
- `entrada_en` solo con `registro_tardio`, y dentro de las últimas 48 horas.
- La salida y el precio se calculan con la hora real de entrada.
- Se ve quién digitó y cuándo.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] POST /estadias acepta `registro_tardio` y `entrada_en` según el contrato.
- [x] Una prueba con una entrada de hace 3 horas calcula bien la salida.

## Módulos a tocar
estadías, PWA (opción «registro tardío» en el asistente).

## Verificación
`npm test -- --test-name-pattern="tard" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- **API:** `POST /estadias` acepta `registro_tardio` con `entrada_en`, en las últimas 48 horas y nunca en el futuro.
  - Responde 400 en estos casos: registro tardío sin hora; hora sin registro tardío; hora de más de 48 horas atrás; hora futura.
  - La tarifa vigente y la salida (franjas de RN-01) se calculan con la hora real. La autorización de datos queda con esa hora.
  - `creada_en` y `creada_por` registran quién digitó y cuándo.
  - El cargo y el pago quedan con la hora en que se digita y entran en la caja del turno abierto, de modo que el dinero se recalcula en el turno que lo recibe (ADR-010) [P].
  - La auditoría marca `registro_tardio: si`.
- **Respuesta:** `Estadia` informa `registro_tardio`, `registrada_por` y `registrada_en`. Es un cambio aditivo, anotado en CONTRATO_API v0.3.3.
- **Prueba de aceptación:** entrada a las 3:10 a. m., digitada a las 6:10 a. m. Sale a las 12 m. del mismo día (franja de madrugada); con la hora de digitación habría sido de 24 horas. El precio es el de la tarifa vigente a las 4:30 a. m., aunque la tarifa cambió a las 5:00. Justo 48 horas atrás se acepta.
- **PWA:**
  - en el paso «Habitación y servicio», una casilla «Viene del talonario» pide el día y la hora reales en hora de Bogotá, limitados a las últimas 48 horas;
  - la cotización usa esa hora;
  - el resumen muestra «Entró … (registro tardío)»;
  - la ficha de la habitación dice cuándo entró y quién lo digitó.
- **Prueba reemplazada:** la del TICKET-04 que esperaba 400 («todavía no está disponible») documentaba un comportamiento provisional. Se cambió por las pruebas del comportamiento que el contrato siempre pidió; no es debilitar una prueba.
- **TDD:**
  - 4 de las 5 pruebas de API fallaron antes de implementar; la quinta (los 400) ya pasaba por el bloqueo provisional;
  - la prueba de `textoTardio` atrapó un punto doble después de «a. m.», y se corrigió el código.
- **Verificación:**
  - **314 pruebas en verde** (305 + 10 − 1 provisional);
  - tipos limpios y compilación correcta.
- **Navegador,** con PGlite y datos sintéticos:
  - sin hora, «Siguiente» queda deshabilitado;
  - con las 3:10 a. m. de hoy, la cotización dice «sale hoy a las 12:00 m. (entró de madrugada)»;
  - se registró en la 201 y la ficha muestra la nota de registro tardío con el usuario y la hora de digitación.
