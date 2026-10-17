# 14: Usuarios, PIN y auditoría (administración)

**ID:** TICKET-14
**Requisitos:** FR-18, FR-20; ADR-003 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La administradora crea usuarios (recepción o administración), los desactiva, cambia un PIN o desbloquea a alguien, y consulta quién hizo cada acción.

**Blocked by:** TICKET-01 (Iniciar sesión y ver el mapa de habitaciones)

**Status:** done

## Invariantes de negocio
- Desactivar revoca todas las sesiones de ese usuario.
- El PIN nuevo es de 6 dígitos y se guarda con Argon2id.
- La auditoría no expone datos de huéspedes.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] GET, POST /usuarios, PATCH /usuarios/{id} y GET /auditoria cumplen el contrato.
- [x] Pasa el escenario «Usuario desactivado».

## Módulos a tocar
identidad, auditoría, PWA (configuración de la administración).

## Verificación
`npm test -- --test-name-pattern="FR-18|usuario|auditor" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- API (solo ADMINISTRACION; recepción recibe 403):
  - `GET /usuarios` lista sin el PIN. `bloqueado_hasta` solo aparece mientras el bloqueo está vigente.
  - `POST /usuarios` crea con PIN en Argon2id. Un usuario repetido responde 409.
  - `PATCH /usuarios/{id}` desactiva o reactiva, cambia el PIN y desbloquea.
  - `GET /auditoria` está paginado, va de lo más reciente a lo más antiguo y filtra por entidad.
- Escenario «Usuario desactivado»: las dos sesiones abiertas de `recepcion3` quedan revocadas (401) y ya no puede iniciar sesión (401).
- Decisiones de diseño [P], anotadas en CONTRATO_API v0.3.1 como cambio aditivo:
  - la administración no puede desactivar su propio usuario (409), para que el hotel no se quede sin quien administre;
  - cambiar el PIN cierra las sesiones abiertas de esa persona, salvo la de quien lo cambia, y borra los intentos fallidos.
- Auditoría:
  - crear o cambiar un usuario queda registrado con detalle sin datos personales (`rol`, `activo`, `pin: cambiado`, `desbloqueo`);
  - el PIN nunca se guarda en la auditoría;
  - una prueba confirma que `GET /auditoria` no contiene el nombre, el documento ni el teléfono de un huésped recién registrado.
- PWA: pestaña **Equipo**, exclusiva de la administración.
  - Agregar persona, con usuario sugerido a partir del nombre y PIN repetido.
  - Cambiar el PIN, desbloquear, desactivar (con confirmación) y reactivar.
  - «Quién hizo qué»: la auditoría en frases sencillas, con filtro y páginas.
- TDD:
  - las 13 pruebas de API fallaron (404) antes de crear las rutas;
  - las 5 pruebas de presentación (`src/web/equipo.test.ts`) fallaron antes de crear `equipo.ts`;
  - una falló después por la lógica (no avisaba que los PIN no coincidían cuando el PIN era inválido). Se corrigió el código, no la prueba.
- Verificación:
  - **269 pruebas en verde** (251 anteriores + 18 nuevas);
  - tipos limpios y compilación de producción correcta.
- Navegador, con PGlite en memoria y datos sintéticos:
  - crear «Laura Prueba Sintética» (sugerencia `laura.prueba`), con el aviso de PIN que no coincide;
  - desactivar `recepcion3`;
  - bloquear `recepcion4` con 5 PIN equivocados y desbloquearlo;
  - en 360 px no hay desborde horizontal; las 5 pestañas de la administración se deslizan de lado, según la regla del TICKET-13.
