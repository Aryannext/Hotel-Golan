# 34: Quiénes se quedan hoy (lista para la policía)

**ID:** TICKET-34
**Requisitos:** FR-31; RN-16; ADR-006 (docs/PRD.md v0.6; fuente: HG-ACT-001 §11 V5-01 y V5-02)

**What to build:** Desde «Habitaciones», recepción abre «Quiénes se quedan hoy»: una lista de las habitaciones ocupadas con el nombre y el documento completo de cada titular. Es para mostrársela a la policía cuando pasa de rutina, como hoy se muestra el talonario. No se envía, no se imprime y no se exporta.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Regla (18-10-2026)
«la policía llega al hotel de pasa de rutina y ve el talonario y pregunta cuales son las personas que se estan quedo esa noche y valida y ya. en ningun momento se le envia información» (V5-02).

## Invariantes de negocio
- Solo recepción del turno y la administración la ven (ADR-003).
- Incluye solo estadías **activas**. Ningún huésped anonimizado aparece.
- El documento se muestra completo solo en esta vista. El mapa y la ficha siguen con el documento enmascarado.
- Cada vez que se abre la lista queda en la auditoría quién la abrió y cuándo, sin los datos (FR-20) [P]. Así hay constancia de cada acceso a datos personales.
- No hay botón de descargar, compartir ni imprimir.
- Solo datos sintéticos en pruebas.

## Criterios de aceptación
- [ ] Con tres habitaciones ocupadas, la lista muestra las tres, con habitación, nombre, tipo y número de documento, ordenadas por habitación.
- [ ] Un titular sin documento aparece con «Sin documento».
- [ ] Sin sesión: 401. Abrirla deja una entrada en la auditoría («Consultó quiénes se quedan hoy»), sin nombres ni documentos.
- [ ] Una estadía terminada no aparece.
- [ ] Se ve bien en un celular de 360 px.

## Módulos a tocar
estadías (consulta de activas con datos completos), auditoría, PWA (Habitaciones), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="FR-31|quiénes se quedan" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
