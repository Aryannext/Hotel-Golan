# 33: Factura prevista entre 1 y 3 días hábiles

**ID:** TICKET-33
**Requisitos:** FR-28; RN-23 (docs/PRD.md v0.6; fuente: HG-ACT-001 §11 V5-09 y V5-10)

**What to build:** Cada solicitud de factura muestra un rango: «lista entre el lunes 19 y el miércoles 21 de octubre». Es de 1 a 3 días hábiles después del día en que se pidió, sin sábados, domingos ni festivos de Colombia. Los textos de la PWA dicen que la factura la manda la administradora, o recepción, al huésped por WhatsApp o por correo.

**Blocked by:** TICKET-25 (Solicitudes de factura; ya hecho).

**Status:** ready-for-agent

## Regla (18-10-2026)
- «depende se demora 1 hasta 3 dias en mandarme la factura»; «no sabados y domingos no trabaja el contador y los festivos tampoco» (V5-09, V5-10).
- La envía la administradora, o la recepcionista a quien se la pase, por WhatsApp o por correo.

Valor anterior [P/V]: una sola fecha, el siguiente día hábil, y un texto que decía que la mandaba el contador.

## Invariantes de negocio
- Se reutiliza el cálculo de días hábiles y festivos del TICKET-25.
- La respuesta agrega `fecha_prevista_hasta` (cambio aditivo). `fecha_prevista` sigue siendo el primer día del rango.
- Las solicitudes ya anotadas reciben su `fecha_prevista_hasta` calculado desde su fecha de registro.

## Criterios de aceptación
- [ ] Pedida el viernes 16-10-2026: entre el 19 y el 21 de octubre.
- [ ] Pedida el viernes 13-11-2026 (el lunes 16 es festivo): entre el 17 y el 19 de noviembre.
- [ ] La ficha y «Por confirmar» muestran «entre el … y el …».
- [ ] La nota de la ficha dice que la factura la envía la administración o recepción por WhatsApp o correo.
- [ ] Los escenarios @pendiente de RN-23 de docs/TESTS_ACEPTACION.feature v0.4 pasan.

## Módulos a tocar
facturación (fechas y respuesta), migración aditiva, PWA (ficha y «Por confirmar»), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="RN-23|factura" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
