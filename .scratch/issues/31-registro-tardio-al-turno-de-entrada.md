# 31: Registro tardío: la plata va al turno en que entró el huésped

**ID:** TICKET-31
**Requisitos:** FR-03 (`registro_tardio`), FR-11, FR-16; ADR-010; RN-10 (docs/PRD.md v0.6; fuente: HG-ACT-001 §11 V5-16)

**What to build:** Cuando una entrada anotada en el talonario se pasa después al sistema, su pago queda en el turno en que de verdad entró el huésped, no en el de quien la digita. Ejemplo: la recepcionista A recibe al huésped a las 3:00 a. m. con el internet caído y cuenta esa plata al entregar el turno. Si B lo digita a las 8:00 a. m., la plata queda en el turno de A. La ficha sigue mostrando quién digitó y cuándo.

**Blocked by:** None (can start immediately).

**Status:** done

## Regla (18-10-2026)
«le corresponde al turno en el cual el huesped entro» y, en el caso de A y B: «en la A» (V5-16). Valor anterior [P]: el dinero entraba a la caja del turno que digita (TICKET-18).

## Decisiones de diseño [P]
- **Turno destino:** el turno cuyo periodo (inicio a fin) contiene la hora real de entrada. Si ese turno sigue abierto, es el mismo comportamiento de hoy.
- **Si ese turno ya se entregó:**
  - el pago queda con su `turno_id`, y el historial y el resumen del día lo cuentan en él;
  - el cierre conserva lo que A contó y la diferencia que hubo al entregar, que fue un sobrante porque la plata estaba en la caja y no en el sistema. Se muestra también la diferencia ajustada después del registro tardío.
- **Aviso:** cuando el registro tardío cae en un turno cerrado, la administración recibe un aviso con el turno, el valor y quién digitó, para que entienda por qué cambió la diferencia.
- La caja abierta de B no cambia.

## Invariantes de negocio
- Nada de dinero se borra ni se reescribe. El cierre original de A se conserva; lo ajustado se calcula aparte (ADR-008).
- La hora real de entrada sigue limitada a las últimas 48 horas (ADR-010).
- Una transferencia de un registro tardío también queda en el turno de entrada, «por verificar» como siempre (RN-12).
- Auditoría con quién digitó, el turno destino y el valor, sin datos personales (FR-20).

## Criterios de aceptación
- [x] Entrada a las 3:00 a. m. (turno de noche de A) digitada por B a las 8:00 a. m.: el pago tiene el turno de A, y la caja abierta de B no sube.
- [x] El detalle del turno de A en el Historial muestra la entrada y la diferencia ajustada; el cierre original no cambia.
- [x] El resumen del día del hotel cuenta esa plata en el día de la entrada real.
- [x] La administración ve el aviso del registro tardío en un turno cerrado.
- [x] Un registro tardío dentro del turno abierto se comporta igual que hoy.

## Módulos a tocar
estadías (registro tardío), caja y turnos (turno por hora y diferencia ajustada), reportes, avisos, PWA (Historial y ficha), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="registro tardío|ADR-010" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase. La prueba de «entra a la caja del turno que digita» se **cambia** porque cambió la regla (V5-16).
