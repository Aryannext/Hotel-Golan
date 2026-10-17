# 25: Solicitudes de factura

**ID:** TICKET-25
**Requisitos:** FR-28; RN-23 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** Recepción anota que un huésped pidió factura (RUT o NIT, correo y teléfono) desde su estadía. La administración la marca como enviada al contador y luego como entregada al huésped. Se muestra la fecha prevista: si se pide un viernes, el lunes (o el martes si es festivo). El sistema no hace facturas.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Invariantes de negocio
- El sistema NO emite ni simula facturas electrónicas ni se conecta con Factus (SOW §5).
- Los datos (RUT o NIT, correo, teléfono) solo los ven recepción del turno y la administración; su tiempo de conservación queda [V] y, mientras tanto, siguen la política de 90 días de los huéspedes [P].
- Estados: PENDIENTE → ENVIADA_AL_CONTADOR → ENTREGADA. Solo la administración avanza los estados.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] Desde la ficha se anota una solicitud; queda PENDIENTE con quién la registró.
- [ ] La administración ve las solicitudes pendientes y las avanza de estado; cada cambio queda auditado sin los datos personales.
- [ ] Una solicitud registrada un viernes muestra como fecha prevista el lunes siguiente.
- [ ] Los datos de la solicitud se borran con la anonimización.

## Módulos a tocar
nuevo módulo de facturación (solo solicitudes), privacidad, PWA (ficha y vista de la administración).

## Verificación
`npm test -- --test-name-pattern="FR-28|factura" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
