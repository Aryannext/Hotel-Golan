# Plan de mejora — Sistema de recepción del Hotel Golán

Parte de los resultados de `06-informe-de-resultados.md` (2026-10-26). Es una propuesta: las fechas son una sugerencia que Cristian confirma o ajusta.

## 1. Diagnóstico (figura 12)
| Fortalezas | Debilidades | Áreas de mejora |
|---|---|---|
| 1. Reglas de dinero, horas y turnos comprobadas: 510 de 510 pruebas automatizadas y 41 de 41 casos funcionales y de seguridad. | 1. La presentación en el celular no se prueba de forma automática: tres de los ocho defectos son de diseño a 360 px (DEF-001, DEF-004, DEF-006). | 1. Usar el método de prueba que ya funciona en la lógica (TDD y casos trazados) también en la pantalla a 360 px. |
| 2. Seguridad y privacidad verificadas: acceso por rol, cookie segura, bloqueo de PIN y auditoría sin datos personales. | 2. Los tamaños de letra y de los botones vienen de la copia del prototipo (`estilos.css`) y no siguen una escala para celular (DEF-003, DEF-005). | 2. Fijar en los estilos del sistema una escala de tamaños: 16 px en los campos y 44 px en los controles táctiles. |
| 3. Rendimiento sobrado: p95 de 17 a 21 ms frente a 300 ms. | 3. Lo escrito en un formulario no se protege al salir (DEF-002), y faltan textos que expliquen el estado (DEF-007, DEF-008). | 3. Aplicar en los formularios largos la misma idea de no perder nada que ya se usa con el dinero (idempotencia), y agregar avisos y ayudas. |
| 4. Trazabilidad completa entre requisito, prueba y resultado. | 4. No hay pruebas con personas ni en dispositivos reales (CP-051 y CP-052 sin ejecutar). | 4. Usar la sesión de práctica (HG-GUIA-002) como prueba de aceptación, con celulares reales. |

## 2. Análisis de causas (Pareto)
Cada defecto se clasificó por su causa principal:

| Causa | Defectos | Frecuencia | % | % acumulado |
|---|---|---|---|---|
| A. Diseño pensado para pantallas más anchas, sin verificación a 360 px | DEF-001, DEF-004, DEF-006 | 3 | 37,5 % | 37,5 % |
| B. Tamaños heredados del prototipo, sin escala para celular | DEF-003, DEF-005 | 2 | 25,0 % | 62,5 % |
| C. Faltan textos de ayuda y de contexto | DEF-007, DEF-008 | 2 | 25,0 % | 87,5 % |
| D. El estado del asistente no se protege al navegar | DEF-002 | 1 | 12,5 % | 100,0 % |

Las causas A y B explican el 62,5 % de los defectos, y las dos se atacan con una sola medida: verificar cada pantalla a 360 px con una escala de tamaños fija. La causa D es una sola, pero toca el trabajo frente al huésped. Por eso va en primera prioridad aunque esté al final del Pareto.

## 3. Fichas de las áreas de mejora (figura 17)

### Área de mejora n.º 1: pantallas verificadas a 360 px
| | |
|---|---|
| Descripción del problema | Tres pantallas fallan a 360 px: la Caja se sale de la pantalla, las pestañas de la administración se esconden y «Siguiente» queda lejos. |
| Causas que provocan el problema | Las pruebas de la PWA solo cubren la lógica (`*.test.ts`), no la presentación. El diseño se revisa a ojo en anchos mayores. |
| Objetivo a conseguir | 0 elementos fuera de la pantalla y 0 secciones ocultas a 360 px en el inicio, la Caja, la entrada, la cuenta y las pestañas de la administración, comprobado con un script que se pueda repetir. |
| Acciones de mejora | 1. Corregir DEF-001 (rejilla `minmax(0, 1fr)`). 2. Corregir DEF-004 (barra inferior con «Más», o pestañas en dos filas). 3. Corregir DEF-006 (pie del asistente fijo abajo, o aviso plegable). 4. Guardar el script de medición de `evidencias/usabilidad-360px.md` como `pruebas/usabilidad-360.ts` para repetirlo. |
| Beneficios esperados | Recepción y la dueña usan todo el sistema desde el celular, sin deslizar la pantalla de lado. |

### Área de mejora n.º 2: escala de tamaños para el dedo y la vista
| | |
|---|---|
| Descripción del problema | Campos de 14,5 px y controles desde 24 px. |
| Causas que provocan el problema | `estilos.css` es una copia fiel del prototipo, pensada para verse bien, no para el uso táctil. |
| Objetivo a conseguir | El 100 % de los campos con letra ≥ 16 px y el 100 % de los controles ≥ 44 × 44 px en las pantallas medidas. |
| Acciones de mejora | 1. Definir en `sistema.css` los tokens `--toque-min: 44px` y `--letra-campo: 16px`. 2. Aplicarlos a las pestañas, la campana, los enlaces de la cuenta y el botón de anular. |
| Beneficios esperados | Menos toques fallidos y nada de zoom en el iPhone. |

### Área de mejora n.º 3: no perder trabajo y explicar el estado
| | |
|---|---|
| Descripción del problema | Lo escrito en la entrada se pierde sin aviso; el documento está bloqueado sin explicación; la cuenta vencida no lo dice. |
| Causas que provocan el problema | El estado del asistente vive solo en su componente; faltan textos de ayuda. |
| Objetivo a conseguir | 0 casos de pérdida de datos al navegar (CP-043 exitoso) y textos de ayuda en los dos casos encontrados (CP-050 sin hallazgos). |
| Acciones de mejora | 1. Preguntar antes de salir del asistente si hay datos escritos, o conservarlos (DEF-002). 2. Ayuda «Elija primero el tipo» en el documento (DEF-007). 3. «Salida vencida hace …» en la cabecera de la cuenta y «Dar salida» o «Extender» destacados (DEF-008). |
| Beneficios esperados | Menos tiempo frente al huésped y menos errores del personal nuevo. |

### Área de mejora n.º 4: aceptación con personas y en el servidor real
| | |
|---|---|
| Descripción del problema | No se ha probado con el personal ni con la dueña, ni en el VPS. |
| Causas que provocan el problema | El TICKET-19 (despliegue) está pendiente por decisión del usuario. |
| Objetivo a conseguir | CP-051 y CP-052 ejecutados, con las dudas registradas, y CP-037 a CP-041 repetidos en el VPS con p95 < 300 ms. |
| Acciones de mejora | 1. Cerrar el TICKET-19. 2. Hacer la práctica con HG-GUIA-002 en los celulares del hotel, incluido uno con iOS si lo hay (para confirmar DEF-003). 3. Correr `node pruebas/humo-entorno.ts <url del VPS>`. |
| Beneficios esperados | Aprobación de la dueña con evidencia, y certeza de que funciona en el entorno real. |

## 4. Priorización de las acciones
| Acción de mejora | Dificultad de implantación | Plazo de implantación | Impacto en la organización | Prioridad |
|---|---|---|---|---|
| Corregir DEF-001 (Caja a 360 px) | Ninguna | Inmediato | Bastante | 1 |
| Corregir DEF-002 (no perder la entrada) | Poca | Corto | Mucho | 2 |
| Corregir DEF-004 (pestañas de la administración) | Poca | Corto | Mucho | 3 |
| Escala de 16 px y 44 px (DEF-003, DEF-005) | Poca | Corto | Bastante | 4 |
| Textos de ayuda y vencida (DEF-007, DEF-008) | Ninguna | Inmediato | Poco | 5 |
| «Siguiente» a la vista (DEF-006) | Poca | Corto | Poco | 6 |
| Script repetible de usabilidad a 360 px | Poca | Corto | Bastante | 7 |
| Corregir el PRD (INC-009) | Ninguna | Inmediato | Poco | 8 |
| Despliegue y aceptación (CP-051, CP-052) | Bastante | Medio | Mucho | 9 |

**Excepciones al orden:**
- **DEF-001 va primero** aunque su impacto es menor que el de DEF-002: es un cambio de una línea de CSS, y conviene quitarlo antes de tomar capturas para la guía.
- **El despliegue y la aceptación van al final** por dificultad y plazo, no por importancia: son la condición para salir a producción.

## 5. Plan de mejora y seguimiento (figura 18)
| Acciones de mejora | Tareas | Responsable de tarea | Tiempos (inicio-final) | Recursos necesarios | Financiación | Indicador seguimiento | Responsable seguimiento |
|---|---|---|---|---|---|---|---|
| Pantallas a 360 px | Corregir DEF-001, DEF-004 y DEF-006; reprobar CP-042, CP-045 y CP-047 | Cristian (con Claude Code) | 2026-10-27 a 2026-10-29 | Repositorio, navegador, este plan | Sin costo (tiempo del desarrollador) | Casos CP-042, CP-045 y CP-047 en «Exitoso»; ancho del documento ≤ 360 px | Cristian |
| Escala de tamaños | Tokens de 16 px y 44 px; reprobar CP-044 y CP-046 | Cristian | 2026-10-27 a 2026-10-29 | `sistema.css` | Sin costo | 0 controles por debajo de 44 px y 0 campos por debajo de 16 px | Cristian |
| No perder trabajo y ayudas | Corregir DEF-002, DEF-007 y DEF-008; reprobar CP-043 y CP-050 | Cristian | 2026-10-28 a 2026-10-30 | Repositorio | Sin costo | CP-043 y CP-050 en «Exitoso» | Cristian |
| Prueba repetible de usabilidad | Pasar el script de medición a `pruebas/usabilidad-360.ts` y correrlo antes de cada PR de la PWA | Cristian | 2026-10-29 a 2026-10-30 | Navegador del entorno | Sin costo | Script en el repositorio y su salida en cada PR | Cristian |
| Regresión | Suite completa, ESLint, tipos y compilación después de cada corrección | Cristian | En cada PR | CI de GitHub (ya configurado) | Sin costo | 510 o más pruebas en verde; CI en verde | Cristian |
| Documentación | Corregir el PRD §5 (INC-009) | Cristian | 2026-10-27 | `docs/PRD.md` | Sin costo | PRD sin la contradicción | Cristian |
| Despliegue y aceptación | TICKET-19; práctica HG-GUIA-002 (CP-051); aceptación de la dueña (CP-052); humo en el VPS | Cristian con Derly y recepción | Cuando el usuario decida el TICKET-19 | VPS, celulares del hotel, guía | VPS pagado por Cristian (ya previsto) | CP-051 y CP-052 ejecutados; acta de aceptación; p95 < 300 ms en el VPS | Derly (dueña) aprueba; Cristian registra |
