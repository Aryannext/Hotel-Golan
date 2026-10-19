# 37: Recordatorio para reportar a los extranjeros a Migración Colombia

**ID:** TICKET-37
**Requisitos:** FR-33 (nuevo); RN-24 (nueva); FR-23 (avisos); FR-20 (auditoría) (docs/PRD.md v0.7; investigación HG-PRIV-002 §1, fila 7; HG-ACT-001 V6-02)

**What to build:** Cuando entra o sale un titular de **otro país**, el sistema le recuerda a recepción reportarlo a Migración Colombia por el SIRE, la página de Migración. Aparece en la campana y en «Pendientes» como «Reportar a Migración: llegada de la 205». Recepción lo reporta en esa página y marca **«Ya lo reporté»** en el sistema. La administración ve qué reportes faltan. El sistema **no se conecta** al SIRE: solo recuerda y deja constancia.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Por qué
Quien aloje a un extranjero debe reportar su llegada y su salida a Migración Colombia por el SIRE (Decreto 1067 de 2015, art. 2.2.1.11.5.1; Resolución 2357 de 2020, arts. 3 y 4). No hacerlo es una infracción con multa (art. 15) [V]. Hoy nadie lo hace: «no nadie avisa» (HG-ACT-001 V6-02). La ley prevalece (indicación del usuario, 18-10-2026).

## Invariantes de negocio
- **Quién es extranjero:** el titular cuya nacionalidad no es Colombia. Se compara sin tildes ni mayúsculas, así que «Colombia», «colombiana» y «COLOMBIANO» cuentan como Colombia [P].
- Al registrar la entrada de un extranjero, queda pendiente un reporte de **llegada**. Al darle salida, queda pendiente uno de **salida**.
- «Ya lo reporté» guarda quién lo marcó y cuándo, y queda en la auditoría sin el nombre ni el documento. Solo se marca una vez; un segundo intento → 409.
- El aviso no muestra el nombre del huésped, solo la habitación, igual que los demás avisos (TICKET-16).
- Si se anula la entrada o el huésped desiste, el reporte pendiente se cancela [P].
- **Plazo:** el plazo exacto del reporte no se pudo leer (Resolución 2357 de 2020, art. 6) [V]. Mientras tanto, el aviso aparece apenas queda pendiente y se marca «atrasado» a las 24 horas, configurable en Ajustes (`horas_reporte_migracion`, 24 [P/V]).
- Solo datos sintéticos en pruebas.

## Antes de usarlo [V]
- El hotel debe tener usuario en el SIRE. Lo tramita la dueña ante Migración Colombia. Hoy no lo tiene: nadie reporta.
- El asesor confirma el plazo y los datos que pide el reporte.

## Criterios de aceptación
- [ ] La entrada de un titular «Venezuela» deja un reporte de llegada pendiente. La de un titular «colombiana», no.
- [ ] La campana y «Pendientes» muestran «Reportar a Migración: llegada de la 205». Después de 24 horas dice «atrasado».
- [ ] Marcar «Ya lo reporté» lo quita de la lista y deja la constancia en la auditoría («Reportó a Migración la llegada de la 205»).
- [ ] Al darle salida, aparece el reporte de salida.
- [ ] Al anular la entrada, el reporte pendiente desaparece.
- [ ] Sin sesión: 401. Marcar dos veces → 409.

## Módulos a tocar
migración nueva (tabla de reportes a Migración, regla `horas_reporte_migracion`), estadías (entrada, salida, anulación y desistimiento), avisos de la PWA, Ajustes, auditoría, CONTRATO_API (aditivo), TESTS_ACEPTACION.

## Verificación
`npm test -- --test-name-pattern="FR-33|Migración" && npm run tipos`; entrada y salida de un extranjero en el navegador.

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
