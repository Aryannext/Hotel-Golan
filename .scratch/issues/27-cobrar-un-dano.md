# 27: Cobrar un daño

**ID:** TICKET-27
**Requisitos:** FR-06; RN-18, RN-07 (docs/PRD.md v0.5; fuente: HG-ACT-001 02.09 y 04.04; auditoría HG-AUD-001, H-02)

**What to build:** Desde la ficha, se carga a la cuenta de la habitación un daño con su descripción (por ejemplo «Vaso roto») y su valor de reposición. Queda como un cargo más: suma al saldo, bloquea la salida hasta que se pague (RN-07) y se puede anular con motivo.

**Blocked by:** None (can start immediately). Antes de construir, confirmar con la administradora quién fija el valor (HG-VAL-001, tema 3).

**Status:** needs-info

## Decisiones por confirmar [V]
- **Quién pone el valor.** RN-18 dice que lo fija la administración. Propuesta [P]: recepción lo anota con el valor que diga la administración por teléfono, y solo la administración puede anularlo o corregirlo. La otra opción es que solo la administración pueda registrarlo.
- **Tope.** ¿Hay un valor máximo que recepción pueda poner sin llamar? Propuesta [P]: sin tope, pero queda en la auditoría.

## Invariantes de negocio
- El daño es un cargo de tipo `DANO` (ya previsto en el esquema), con descripción obligatoria (3 a 120 caracteres) y valor entero mayor que $0, en COP.
- No sale del catálogo ni tiene existencias.
- Se anula, no se borra (ADR-008); la anulación pide motivo (FR-17).
- Auditoría con usuario, hora, valor y estadía, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas.

## Criterios de aceptación
- [ ] Un daño «Toalla manchada» de $25.000 en la 205 aparece en los cargos con quién lo registró, y el saldo sube $25.000.
- [ ] Sin descripción o con valor $0: 400.
- [ ] Con el daño sin pagar, la salida responde 409 `SALDO_PENDIENTE`.
- [ ] El rol que la administradora decida es el único que puede registrarlo; los demás reciben 403.
- [ ] La auditoría muestra «Cobró un daño de $25.000».

## Módulos a tocar
cargos de la estadía, auditoría, PWA (ficha: «Agregar» → «Daño»), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="RN-18|daño" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
