# 14: Usuarios, PIN y auditoría (administración)

**ID:** TICKET-14
**Requisitos:** FR-18, FR-20; ADR-003 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La administradora crea usuarios (recepción o administración), los desactiva, cambia un PIN o desbloquea a alguien, y consulta quién hizo cada acción.

**Blocked by:** TICKET-01 (Iniciar sesión y ver el mapa de habitaciones)

**Status:** ready-for-agent

## Invariantes de negocio
- Desactivar revoca todas las sesiones de ese usuario.
- El PIN nuevo es de 6 dígitos y se guarda con Argon2id.
- La auditoría no expone datos de huéspedes.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] GET, POST /usuarios, PATCH /usuarios/{id} y GET /auditoria cumplen el contrato.
- [ ] Pasa el escenario «Usuario desactivado».

## Módulos a tocar
identidad, auditoría, PWA (configuración de la administración).

## Verificación
`npm test -- --test-name-pattern="FR-18|usuario|auditor" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
