# 28: Aviso de privacidad visible en la entrada

**ID:** TICKET-28
**Requisitos:** FR-05; RN-16; ADR-006 (docs/PRD.md v0.5; SOW §4 y §10; auditoría HG-AUD-001, H-03)

**What to build:** En el paso del titular de la entrada, recepción ve el texto del aviso de privacidad aprobado por la administradora, para leérselo al huésped. Puede abrirlo completo con un toque. La casilla «el huésped autorizó» guarda la versión de ese texto. Mientras no haya un texto aprobado, el sistema no se usa con huéspedes reales.

**Blocked by:** None para el borrador. La parte de la PWA espera el texto aprobado por la administradora (HG-VAL-001, tema 1).

**Status:** needs-info

## Pasos
1. **Borrador [P]** en lenguaje sencillo: quién recoge los datos (el hotel), para qué (registro de la estadía y su cobro), qué datos se guardan, quién los ve (recepción del turno y administración), cuánto tiempo (3 meses [P/V]) y a quién pedir que los borren o corrijan. El borrador **no es asesoría legal**: lo revisa un asesor (guía de la SIC, el contador o un abogado; ADR-006).
2. **Aprobación** de la administradora, con la fecha. Se registra en HG-ACT-001.
3. **PWA:** el texto aprobado y su versión salen de un solo lugar del código. La entrada muestra un resumen y el texto completo.

## Invariantes de negocio
- Sin la casilla no se guarda la entrada (422; ya implementado, FR-05).
- La versión guardada en `autorizaciones_datos` coincide con el texto mostrado. Si el texto cambia, cambia la versión, y las autorizaciones anteriores conservan la suya.
- El texto no promete nada que el sistema no haga: por ejemplo, el borrado a los 3 meses ya existe (FR-21).
- No se usan datos reales en pruebas ni en herramientas de IA (Circular SIC 002 de 2024).

## Criterios de aceptación
- [ ] Existe el borrador del aviso en `docs/` (no en el repositorio público hasta que se apruebe).
- [ ] La administradora lo aprobó, y hay constancia con la fecha [V].
- [ ] En la entrada se ve el aviso; «Ver completo» lo muestra entero y se puede cerrar con Escape.
- [ ] La autorización guardada tiene la versión del texto mostrado.

## Módulos a tocar
documentación (borrador y aprobación), PWA (paso del titular), constante de la versión del aviso.

## Verificación
`npm test -- --test-name-pattern="FR-05|aviso" && npm run tipos`; revisión en el navegador del paso del titular.

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
