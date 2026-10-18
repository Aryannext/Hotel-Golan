# 27: Cobrar un daño

**ID:** TICKET-27
**Requisitos:** FR-06; RN-18, RN-07 (docs/PRD.md v0.6; fuente: HG-ACT-001 02.09, 04.04 y §11 V5-06; auditoría HG-AUD-001, H-02)

**What to build:** La administración, desde su celular, carga a la cuenta de una habitación ocupada un daño con su descripción (por ejemplo «Vaso roto») y su valor de reposición. Queda como un cargo más: suma al saldo, bloquea la salida hasta que se pague (RN-07) y se puede anular con motivo. Recepción no puede cargar daños: llama a la administradora, que es quien sabe cuánto vale «como nuevo».

**Blocked by:** None (can start immediately).

**Status:** done

## Regla confirmada por la administradora (18-10-2026)
«lo decide la administradora que sabe cuanto vale eso nuevo. no la persona de recepción no puede ponerle valor en ese momento, me tiene que llamar.» (V5-06)

## Invariantes de negocio
- Solo el rol ADMINISTRACION registra daños; recepción recibe 403. En la ficha, recepción ve un texto: «Los daños los cobra la administradora: llámela».
- El daño es un cargo de tipo `DANO` (ya previsto en el esquema), con descripción obligatoria (3 a 120 caracteres) y valor entero mayor que $0, en COP. No sale del catálogo ni tiene existencias.
- Se anula, no se borra (ADR-008); la anulación pide motivo (FR-17).
- Auditoría con usuario, hora, valor y estadía, sin datos personales (FR-20).
- Recepción ve el daño en la cuenta y lo cobra como cualquier saldo.
- Solo datos sintéticos en pruebas.

## Criterios de aceptación
- [x] La administración carga «Toalla manchada» por $25.000 a la 205: aparece en los cargos con quién lo registró y el saldo sube $25.000.
- [x] Recepción intenta cargar un daño: 403.
- [x] Sin descripción o con valor $0: 400.
- [x] Con el daño sin pagar, la salida responde 409 `SALDO_PENDIENTE`; al pagarlo, la salida se puede dar.
- [x] La auditoría muestra «Cobró un daño de $25.000».

## Módulos a tocar
cargos de la estadía, auditoría, PWA (ficha: «Cobrar un daño» solo para la administración), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="RN-18|daño" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
