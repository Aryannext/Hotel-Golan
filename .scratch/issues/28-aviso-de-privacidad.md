# 28: Aviso de privacidad visible en la entrada

**ID:** TICKET-28
**Requisitos:** FR-05; RN-16; ADR-006 (docs/PRD.md v0.6; SOW §4 y §10; HG-ACT-001 §11 V5-01 y V5-02; auditoría HG-AUD-001, H-03)

**What to build:** En el paso del titular de la entrada, recepción ve el texto del aviso de privacidad aprobado por la administradora, para leérselo al huésped. Puede abrirlo completo con un toque. La casilla «el huésped autorizó» guarda la versión de ese texto. Mientras no haya un texto aprobado, el sistema no se usa con huéspedes reales.

**Blocked by:** None para el borrador. La parte de la PWA espera el texto aprobado por la administradora.

**Status:** needs-info (falta el texto aprobado)

## Lo que dijo la administradora (18-10-2026) y debe reflejar el borrador
- **Para qué:** «por temas de seguridad». La policía pasa de rutina, mira quiénes se quedan esa noche y valida la cédula en su teléfono. **No se le envían datos** (V5-01, V5-02).
- **Cuánto tiempo:** se borran a los **90 días**, no a pedido inmediato (V5-01).
- **Quién atiende** una solicitud de borrado o corrección: no se respondió [V].

## Pasos
1. **Borrador [P]** en lenguaje sencillo:
   - quién recoge los datos: el hotel;
   - para qué: el registro de la estadía, su cobro y la seguridad, incluida la consulta de rutina de la policía en el hotel;
   - qué datos se guardan;
   - quién los ve: recepción del turno, la administración y, en la visita de rutina, la policía;
   - cuánto tiempo: 90 días;
   - a quién pedir que los borren o corrijan.

   El borrador **no es asesoría legal**: lo revisa un asesor (guía de la SIC, el contador o un abogado; ADR-006).
2. **Aprobación** de la administradora, con la fecha. Se registra en HG-ACT-001.
3. **PWA:** el texto aprobado y su versión salen de un solo lugar del código. La entrada muestra un resumen y el texto completo.

## Invariantes de negocio
- Sin la casilla no se guarda la entrada (422; ya implementado, FR-05).
- La versión guardada en `autorizaciones_datos` coincide con el texto mostrado. Si el texto cambia, cambia la versión, y las autorizaciones anteriores conservan la suya.
- El texto no promete nada que el sistema no haga: el borrado a los 90 días ya existe (FR-21), y la lista para la policía la trae el TICKET-34.
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
