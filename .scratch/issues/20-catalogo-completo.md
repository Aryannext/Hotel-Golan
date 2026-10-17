# 20: Catálogo completo en Ajustes

**ID:** TICKET-20
**Requisitos:** FR-24; RN-19, RN-13 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** La administración crea y edita productos de todos los grupos (nevera, vitrina, lavandería y otros) con su precio, y los activa o desactiva desde Ajustes, sin llamar al desarrollador. Un producto nuevo de vitrina queda listo para cargarse a una habitación.

**Blocked by:** None (can start immediately)

**Status:** done

## Invariantes de negocio
- Solo ADMINISTRACION crea productos y cambia precios (T4-2, T4-13); recepción solo los usa.
- Un cambio de precio aplica a lo que se registre después; los cargos anteriores conservan su precio.
- La sección 1 de la vitrina (de la familiar de la dueña) no va en el sistema (RN-13, T4-10): ningún producto queda marcado como de otra persona.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] En Ajustes se pueden agregar, editar, quitar y volver a poner productos de Vitrina, además de los grupos que ya existían.
- [x] Un producto de vitrina creado por la administración aparece en «Agregar cargos» de la ficha y se puede cargar a la habitación.
- [x] Recepción no puede crear ni editar productos (403), aunque llame la API directamente.
- [x] El catálogo ya no ofrece ni guarda productos de la sección 1 ni de otro dueño distinto del hotel.

## Módulos a tocar
configuracion, PWA (Ajustes y ficha).

## Verificación
`npm test -- --test-name-pattern="FR-24|productos|catálogo" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (17-10-2026)
- API: `POST`/`PUT /productos` aceptan los grupos `VITRINA_PASABOCAS` y `VITRINA_ASEO` como los demás. `pertenece_a` ya no es obligatorio y solo admite `HOTEL`; `seccion` va de 2 a 6. Un producto `FAMILIAR` o de la sección 1 responde 400 y no se guarda (RN-13, T4-10). CONTRATO_API v0.4.0.
- Se cambió la prueba «un producto de la sección 1 puede ser de la familiar» porque cambió la regla (RN-13 en PRD v0.4): ahora espera el 400. No es una prueba debilitada.
- PWA: Ajustes ofrece «Vitrina de pasabocas» y «Vitrina de aseo»; la ficha agrupa el catálogo en nevera, vitrinas, lavandería y otros. Un solo listado de grupos (`GRUPOS`) para Ajustes y la ficha.
- TDD: 5 pruebas en rojo (API, agrupación y grupos editables) antes del cambio; luego en verde.
- Verificación: 360 pruebas en verde; lint, tipos y compilación correctos.
- Navegador, con datos sintéticos: la administración creó «Galletas de prueba» ($2.000) en la vitrina de pasabocas desde Ajustes; recepción lo vio en «Agregar cargos» de la 205, bajo «Vitrina de pasabocas».
