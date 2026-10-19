# 28: Aviso de privacidad visible en la entrada

**ID:** TICKET-28
**Requisitos:** FR-05; RN-16; ADR-006 (docs/PRD.md v0.7; SOW §4 y §10; HG-ACT-001 §11 V5-01 y V5-02, y §12 V6-01 a V6-12; aviso HG-PRIV-001 v0.4; investigación HG-PRIV-002; auditoría HG-AUD-001, H-03)

**What to build:** En el paso del titular de la entrada, recepción ve el **texto corto** del aviso de privacidad, aprobado por la dueña, para decírselo al huésped. Con un toque abre la **política completa**. La casilla «el huésped autorizó» guarda la versión de ese texto. Los datos del hotel que aparecen en el aviso (responsable, NIT, Registro Nacional de Turismo, dirección y teléfono) **no van en el código**, que es público: la administración los escribe en Ajustes.

**Blocked by:** None para construir la pantalla. Para usarlo con huéspedes reales hay que esperar la revisión del asesor y los TICKETS 36 a 38.

**Status:** ready-for-agent (el texto corto está aprobado; la parte legal espera la revisión del asesor)

## Lo decidido (18-10-2026)
- **Enfoque:** el hotel registra a los huéspedes porque la ley lo exige: la Tarjeta de Registro de Alojamiento (Ley 2068 de 2020, art. 22) y, para los extranjeros, el reporte a Migración Colombia (SIRE). Lo pidió el usuario: la ley prevalece sobre lo que pida el hotel.
- **Texto corto aprobado por la dueña:** «el texto me suena bien» (V6-09). Está en HG-PRIV-001 v0.4 §1, en `docs/` de OneDrive. Se copia al código tal cual, sin datos del hotel.
- **Quién atiende** las solicitudes: la recepción, que se comunica con la dueña (V6-08).
- **Datos del hotel:** la dueña los dio (V6-06, V6-10 a V6-12) y están en el acta, fuera del repositorio. Su número de documento no se registra: lo escribe ella en persona.
- **Plazo de conservación:** por definir con la ley (TICKET-38). El texto completo no promete un plazo hasta tenerlo.

## Invariantes de negocio
- Sin la casilla no se guarda la entrada (422; ya implementado, FR-05).
- La versión guardada en `autorizaciones_datos` coincide con el texto mostrado. Si el texto cambia, cambia la versión, y las autorizaciones anteriores conservan la suya. El formato `AV-AAAA-MM` ya existe.
- El texto y su versión salen de un solo lugar del código. Los datos del hotel salen de la configuración (Ajustes, solo la administración).
- **Si falta algún dato del hotel en Ajustes, la entrada muestra el aviso igual**, con una advertencia para la administración: «Faltan los datos del hotel en el aviso».
- El texto no promete nada que el sistema no haga. El documento obligatorio lo trae el TICKET-36, el recordatorio de Migración el TICKET-37 y el plazo el TICKET-38. Hasta que estén, el texto completo marca esas partes como pendientes, o este ticket se integra después de ellos.
- No se usan datos reales en pruebas, en el código ni en herramientas de IA (Circular SIC 002 de 2024).

## Criterios de aceptación
- [x] Existe el borrador del aviso en `docs/` (HG-PRIV-001, fuera del repositorio público).
- [x] La dueña aprobó el texto corto, con constancia y fecha (HG-ACT-001 V6-09, 18-10-2026).
- [ ] Un asesor revisó la parte legal [V].
- [ ] La administración escribe los datos del hotel en Ajustes, y el aviso los muestra.
- [ ] En la entrada se ve el texto corto. «Ver completo» muestra la política entera y se cierra con Escape.
- [ ] La autorización guardada tiene la versión del texto mostrado.
- [ ] Se ve bien en un celular de 360 px.

## Módulos a tocar
PWA (paso del titular, vista de la política), constante del texto y la versión del aviso, configuración (datos del hotel: migración y Ajustes), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="FR-05|aviso" && npm run tipos`; revisión en el navegador del paso del titular y de Ajustes.

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
