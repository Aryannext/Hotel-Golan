# 01: Iniciar sesión y ver el mapa de habitaciones

**ID:** TICKET-01
**Requisitos:** FR-19, FR-01 (lectura), FR-20; ADR-001, ADR-003, ADR-009 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Una recepcionista abre la PWA, entra con su usuario y PIN de 6 dígitos y ve las 12 habitaciones con su tipo y estado. Si falla el PIN 5 veces, queda bloqueada 15 minutos. Es el esqueleto de punta a punta: API Fastify, PWA en Preact + TypeScript con el estilo del prototipo, sesión en cookie y formato de error común.

**Blocked by:** None (can start immediately) — no depende de otro ticket.

**Status:** ready-for-agent

## Invariantes de negocio
- El PIN se compara contra el hash Argon2id; nunca se guarda ni se registra en claro.
- Cookie `sesion`: HttpOnly, Secure (en producción), SameSite=Strict, 12 horas; el token se guarda como hash.
- Tras 5 fallos seguidos, 423 USUARIO_BLOQUEADO durante 15 minutos aunque el PIN sea correcto.
- Todo endpoint, salvo POST /sesiones, exige sesión y verifica el rol en el servidor (`x-roles`).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /sesiones, GET y DELETE /sesiones/actual y GET /habitaciones cumplen CONTRATO_API.yaml.
- [ ] Pasan los escenarios de la regla «FR-19 — Inicio de sesión» de TESTS_ACEPTACION.feature.
- [ ] La PWA muestra el mapa con datos de la semilla (205 y 211 ocupadas, 207 por revisar, 301 en mantenimiento).
- [ ] Los errores responden `{codigo, mensaje}` en español sencillo.
- [ ] Queda `npm test` (node --test) para la API y una prueba de humo de la PWA.

## Módulos a tocar
identidad (usuarios, sesiones), habitaciones (lectura), auditoría, plataforma HTTP (servidor, errores, validación por esquema), PWA (inicio de sesión y mapa).

## Verificación
`npm test && npm run tipos; manual: docker compose up -d db, npm run db:reiniciar, abrir la PWA y entrar con un usuario de la semilla.`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
