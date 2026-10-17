# 16: Avisos en pantalla

**ID:** TICKET-16
**Requisitos:** FR-23; RN-04 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La campana y el inicio muestran salidas vencidas («corre $8.000 por hora»), pagos por verificar y habitaciones por revisar o en limpieza, actualizados en vivo.

**Blocked by:** TICKET-05 (Transferencia por verificar y confirmación en tiempo real), TICKET-08 (Dar salida y revisar la habitación)

**Status:** done

## Invariantes de negocio
- Los avisos no contienen datos personales completos (solo número de habitación y valores).
- Se recalculan con los eventos SSE.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] La PWA muestra los avisos de la semilla (211 con pago por verificar; 207 por revisar).
- [x] Una salida vencida aparece sin recargar.

## Módulos a tocar
tiempo_real, PWA (campana e inicio).

## Verificación
`npm test -- --test-name-pattern="FR-23|aviso" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- **Diseño:** no cambian la API ni el contrato. Los avisos se calculan en la PWA (`src/web/avisos.ts`) con `GET /habitaciones` y `GET /reglas`:
  - salida vencida: «corre $8.000 por hora; desde las 4:00 p. m. se cobra la noche completa», con los valores de las reglas (RN-04);
  - transferencia por verificar;
  - habitación por revisar;
  - habitación en limpieza.
  Van ordenados de lo más urgente a lo menos y solo llevan número de habitación y valores, nunca nombres.
- **Tiempo real:**
  - cada evento SSE recarga las habitaciones y los avisos se recalculan;
  - la hora de la pantalla se renueva cada 30 s y el vencimiento se compara con la hora actual, así que una salida vencida aparece sin recargar y sin esperar al servidor.
- **PWA:**
  - campana en la barra superior, con contador (rojo si hay algo urgente) y lista desplegable; en el celular la lista ocupa el ancho de la pantalla;
  - «Pendientes» al inicio de Habitaciones;
  - al tocar un aviso: la salida vencida abre la cuenta de la habitación; la transferencia abre la cuenta (recepción) o «Por confirmar» (administración); por revisar y limpieza abren el panel de estado.
- **Decisiones [P]:**
  - las habitaciones en mantenimiento no generan aviso, porque el ticket no las incluye;
  - desde 24 horas, el tiempo vencido se muestra en días y horas.
- **TDD:**
  - las pruebas de `src/web/avisos.test.ts` y la aceptación con la semilla (`src/api/avisos.test.ts`) fallaron antes de crear el módulo;
  - el formato en días se agregó después de verlo en el navegador, también con la prueba primero.
- **Verificación:**
  - **299 pruebas en verde** (291 + 8);
  - tipos limpios y compilación correcta.
- **Navegador**, con PGlite y datos sintéticos, como recepción:
  - aparecen 205 y 211 vencidas, 211 con transferencia por verificar, 207 por revisar y 204 en limpieza;
  - al marcar la 204 disponible desde su aviso, desaparece sin recargar;
  - el aviso vencido de la 205 abre su cuenta;
  - en 360 px no hay desborde.
- **Corrección hecha en el navegador:** la lista usaba la clase `.avisos`, que `estilos.css` ya ocupa para las notificaciones flotantes del prototipo. Se renombró a `.lista-avisos`.
