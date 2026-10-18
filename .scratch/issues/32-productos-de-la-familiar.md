# 32: Productos de la familiar: la regla es por dueño, no por sección

**ID:** TICKET-32
**Requisitos:** FR-24; RN-13, RN-19 (docs/PRD.md v0.6; fuente: HG-ACT-001 §11 V5-19)

**What to build:** La administración puede crear productos del hotel en cualquier sección de la vitrina, incluida la 1. En Ajustes, junto al catálogo, se recuerda en palabras sencillas que los productos de la familiar (champú, crema para el cabello y similares) no se registran ni se cobran en el sistema, estén en la sección que estén.

**Blocked by:** None (can start immediately).

**Status:** done

## Regla (18-10-2026)
«mi familiar vende shampoo, crema para el cabello cositas asi verdad como eso es de ella se deja aparte […] ese producto puedes estar en cualquer seccion de la vitrina pero en este caso esta en pa primera nada más. esto no debe de entrar en caja por que no es mio.» (V5-19)

Valor anterior: la API rechazaba productos de la sección 1 (TICKET-20; T4-10).

## Invariantes de negocio
- `pertenece_a` sigue admitiendo solo `HOTEL`: los productos de la familiar no se crean.
- `seccion` pasa a aceptar de 1 a 6 en la API. La base ya lo permite.
- Recepción no recibe ni cobra en el sistema la plata de la familiar. Sigue el procedimiento: avisa a la administradora y la familiar la recoge.
- Los productos existentes no cambian.

## Criterios de aceptación
- [x] Crear un producto del hotel en la sección 1: 201.
- [x] Crear un producto con `pertenece_a: FAMILIAR`: 400, como hoy.
- [x] Ajustes muestra la nota sobre los productos de la familiar.
- [x] CONTRATO_API: `seccion` de 1 a 6 (v0.4.6, cambio aditivo).

## Módulos a tocar
configuración (productos), PWA (Ajustes), CONTRATO_API.

## Verificación
`npm test -- --test-name-pattern="FR-24|RN-13" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase. La prueba de «sección 1 → 400» se **cambia** porque cambió la regla (V5-19).
