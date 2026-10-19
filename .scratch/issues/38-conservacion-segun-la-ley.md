# 38: Guardar los datos de los huéspedes el tiempo que exija la ley

**ID:** TICKET-38
**Requisitos:** FR-21; RN-16; ADR-006 (docs/PRD.md v0.7; investigación HG-PRIV-002 §1, fila 5, y §2, hallazgo B)

**What to build:** El borrado automático de los datos de los huéspedes (TICKET-17) usa el plazo que exige la ley, y no uno menor. En Ajustes, la regla «Días que se guardan los datos del huésped» explica que ese plazo lo fija la ley y no deja bajarlo del mínimo legal.

**Blocked by:** la confirmación del plazo legal por el contador o el asesor (HG-PRIV-001 §3, pregunta 2 para el contador).

**Status:** needs-info (falta el plazo que exige la ley)

## Por qué
La dueña pidió borrar a los 90 días (V5-01). Una norma de 2016 obligaba a conservar el registro de huéspedes al menos **5 años** desde la salida (Decreto 1964 de 2016) [V], y no se confirmó si sigue vigente después del Decreto 1836 de 2021. Los talonarios de hoy se guardan sin plazo fijo (V6-03). Si la ley pide más que 90 días, se cumple la ley (indicación del usuario, 18-10-2026).

## Lo que ya existe
- La regla `retencion_datos_dias` (90) se configura en Ajustes, entre 1 y 3650 días. Cinco años son 1826 días, así que cabe sin cambiar el rango.
- La anonimización también borra el nombre de los externos de lavandería y los datos de la factura (RUT, correo, celular). El asesor dice si cada uno tiene su propio plazo: los soportes contables suelen guardarse más tiempo [V].

## Invariantes de negocio
- El mínimo legal (`retencion_minima_legal_dias`) se guarda aparte del valor configurado. Ajustes no acepta un valor menor: 422 con «La ley pide guardarlos al menos N días».
- Cambiar el plazo no revive datos ya borrados.
- Si el plazo legal resulta igual o menor a 90 días, este ticket solo deja escrita la fuente y no cambia el comportamiento.

## Criterios de aceptación
- [ ] Con el plazo confirmado (N días), la semilla y la migración dejan `retencion_datos_dias` en N.
- [ ] Intentar bajarlo de N en Ajustes → 422 con el mensaje claro.
- [ ] Un huésped que salió hace 91 días sigue con sus datos si N > 91. Pasados N días, se anonimiza.
- [ ] El aviso de privacidad (HG-PRIV-001 y TICKET-28) dice el mismo plazo.

## Módulos a tocar
configuración (reglas y migración), anonimización, Ajustes de la PWA, CONTRATO_API (aditivo), aviso de privacidad.

## Verificación
`npm test -- --test-name-pattern="FR-21|retención|anonimiz" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
