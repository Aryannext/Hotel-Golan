# Reporte de incidencias — Sistema de recepción del Hotel Golán

Ciclo de vida: Nuevo → Abierto → Asignado → Diferido (bajo impacto) / Reabierto → Verificado → Cerrado

Entorno de todas las incidencias: `http://localhost:3001`, `main` en `dbd24b3`, Chromium emulando 360 × 780 px (salvo que se diga otra cosa), semilla sintética.

| Identificador | Resumen | Caso | Fecha y hora | Entradas | Resultado esperado | Resultado obtenido | Impacto en las pruebas | Estado | ¿Es defecto? |
|---|---|---|---|---|---|---|---|---|---|
| INC-001 | En la Caja, «Salió plata» se sale de la tarjeta y la página se desplaza de lado | CP-042 | 2026-10-26 13:58 | Pestaña Caja, 360 px | Botones dentro de la tarjeta; ancho ≤ 360 px | Botón hasta x = 418; documento de 418 px | Ninguno sobre otros casos | Abierto | Sí → DEF-001 |
| INC-002 | La entrada a medio llenar se pierde al cambiar de pestaña o tocar «Volver», sin aviso | CP-043 | 2026-10-26 14:00 | «Huésped Prueba CF35»; tocar «Caja» | Conservar los datos o preguntar antes de salir | Nombre vacío; sin aviso | Ninguno | Abierto | Sí → DEF-002 |
| INC-003 | Los campos tienen letra de 14,5 px; el iPhone acerca la pantalla al tocarlos | CP-044 | 2026-10-26 13:59 | Paso 1 de la entrada | ≥ 16 px | 14,5 px en los 5 campos | El zoom no se pudo observar en Chromium (riesgo R3 del plan) | Abierto | Sí → DEF-003 |
| INC-004 | A 360 px la administración solo ve 3 de sus 6 pestañas, sin señal de que hay más | CP-045 | 2026-10-26 14:02 | Sesión de `admin` | Todas visibles o un «Más» | Historial cortada; Equipo y Ajustes fuera | Ninguno | Abierto | Sí → DEF-004 |
| INC-005 | Controles más pequeños que 44 px (pestañas, campana, «Agregar», «Registrar pago», «Daño», anular) | CP-046 | 2026-10-26 13:58–14:03 | Inicio, Caja y cuenta de la 205 | ≥ 44 × 44 px | Desde 24 px | Ninguno | Abierto | Sí → DEF-005 |
| INC-006 | En el paso 1 de la entrada, «Siguiente» queda a casi 2 pantallas, debajo del aviso de privacidad | CP-047 | 2026-10-26 13:59 | Paso 1, 360 × 780 | A menos de una pantalla, o fijo abajo | y = 1488 px (1,91 pantallas) | Ninguno | Abierto | Sí → DEF-006 |
| INC-007 | El número de documento está bloqueado hasta elegir el tipo, sin decirlo | CP-050 | 2026-10-26 14:00 | Escribir en el número sin elegir el tipo | Que se pueda escribir, o que una ayuda diga «elija primero el tipo» | `disabled`, sin ayuda; lo escrito no entra | Al principio hizo dudar del resultado de CP-043 (se aclaró midiendo) | Abierto | Sí → DEF-007 |
| INC-008 | La cuenta de una estadía vencida no lo dice, y «Dar salida» no se destaca | CP-050 | 2026-10-26 14:03 | Cuenta de la 205 (salida el 13/10 a las 12 m., ya pasada) | La cabecera dice que está vencida; acción principal destacada | «sale 13/10 12:00 m.»; 6 botones iguales | Ninguno | Abierto | Sí → DEF-008 |
| INC-009 | El PRD se contradice: el requisito no funcional de privacidad dice «documento opcional», pero RN-16 v0.7 y el sistema (TICKET-36) lo exigen | Revisión de los documentos de referencia | 2026-10-26 14:10 | `docs/PRD.md` §5 frente a RN-16 | Un solo criterio en todo el PRD | Dos criterios distintos | Ninguno; las pruebas siguen RN-16 y el contrato v0.5 | Abierto | No: es un documento desactualizado, no un fallo del sistema. Se corrige el PRD. |
| INC-010 | En la primera medición, el contraste de «Siguiente», «Entregar turno» y la cabecera de la cuenta salió en 1,11:1 | CP-048 | 2026-10-26 13:45 | Botones con fondo degradado | Medición correcta | El script no leía el fondo degradado y tomaba el color crema de detrás | El script se corrigió y repitió: excluye los fondos degradados | Cerrado | No: error del instrumento de medición. A simple vista, el texto blanco sobre bronce oscuro se lee bien. |

## Seguimiento
| Incidencia | Fecha | Estado anterior | Estado nuevo | Quién | Nota |
|---|---|---|---|---|---|
| INC-001 a INC-009 | 2026-10-26 | Nuevo | Abierto | Claude Code | Analizadas y confirmadas en el entorno |
| INC-010 | 2026-10-26 | Nuevo | Cerrado | Claude Code | No es defecto del sistema; se corrigió el script de medición |

## Repruebas y regresión
Todavía no hay correcciones. Cuando se corrijan los defectos, se repiten CP-042 a CP-047 y CP-050, junto con la suite completa como prueba de regresión. El resultado se anota aquí.

| Incidencia | Caso reprobado | Resultado | Regresión (suite completa) | Fecha |
|---|---|---|---|---|
| — | — | — | — | — |
