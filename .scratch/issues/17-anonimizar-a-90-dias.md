# 17: Anonimizar los datos de huéspedes a los 90 días

**ID:** TICKET-17
**Requisitos:** FR-21; RN-16; ADR-006 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Una tarea diaria borra nombre, documento y teléfono de los huéspedes cuya estadía terminó hace más de `retencion_datos_dias` (90). Se conservan importes y movimientos; en pantalla aparece «Huésped anonimizado».

**Blocked by:** TICKET-04 (Registrar una entrada pagada en efectivo)

**Status:** done

## Invariantes de negocio
- CHECK del esquema: un huésped anonimizado no conserva nombre, documento ni teléfono.
- La auditoría registra ANONIMIZAR sin el dato borrado.
- Los 90 días son una interpretación [P/V] que debe confirmar la administradora; el valor es configurable.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] Pasa el escenario «Anonimizar a los 90 días» (salida el 10-07-2026, tarea el 09-10-2026).
- [x] La tarea es idempotente: correrla dos veces no falla ni duplica la auditoría.

## Módulos a tocar
privacidad, tareas programadas, auditoría.

## Verificación
`npm test -- --test-name-pattern="FR-21|anonimiza" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- **Tarea:** `src/api/privacidad/anonimizacion.ts`, función `anonimizarVencidos(bd, ahora)`.
  - Borra nombre, tipo y número de documento, y teléfono, y marca `anonimizado_en`.
  - Solo toca huéspedes sin estadía activa cuya última salida (normal o por desistimiento) fue hace más de `retencion_datos_dias`, que se lee de Reglas y se cambia en Ajustes.
  - Se conservan la nacionalidad, los cargos, los pagos, la cuenta y la autorización de datos.
  - Respeta el CHECK del esquema.
- **Auditoría:** una entrada `ANONIMIZAR` por corrida que borre algo, sin usuario porque es una tarea programada, con el detalle `{ cantidad }` y sin el dato borrado. «Quién hizo qué» la muestra como «Borró los datos personales de N huéspedes (plazo de retención cumplido)».
- **Programación:**
  - `programarAnonimizacion` corre al arrancar el servidor y luego cada hora; es idempotente y no deja que dos corridas se pisen;
  - `src/api/servidor.ts` la inicia y la detiene al apagar;
  - `npm run privacidad:anonimizar` la corre a mano en el VPS.
- **Pruebas** (`src/api/anonimizacion.test.ts`):
  - escenario de aceptación: salida el 10-07-2026 11:00 y tarea el 09-10-2026;
  - borde: el 08-10-2026 a las 10:59 todavía no se borra;
  - con 200 días de retención no se borra nada;
  - estadía desistida antigua: se borra;
  - estadías recientes y activas: intactas;
  - la segunda corrida da 0 y no duplica la auditoría;
  - la tarea programada corre al arrancar.
- **TDD:** las 6 pruebas fallaron (falta del módulo) antes de implementarlo, y los 2 casos nuevos de actividad fallaron antes de cambiar `equipo.ts`.
- **Verificación:**
  - **305 pruebas en verde** (299 + 6);
  - tipos limpios y compilación correcta;
  - no hay pantalla nueva: «Huésped anonimizado» ya existía en la ficha y el mapa;
  - el comando manual no se corrió contra PostgreSQL porque Docker estaba apagado; la tarea se probó con PGlite.
- **Pendiente [P/V]:** los 90 días son una interpretación de «el talonario se cambia cada 3 meses». Debe confirmarlos la administradora (HG-ACT-001 T3-5), junto con el texto del aviso de privacidad. Si cambia el plazo, basta con ajustar la regla.
