# Informe de resultados de pruebas — Sistema de recepción del Hotel Golán

| Campo | Valor |
|---|---|
| Versión probada | `main` en `dbd24b3` (PR #38), Node v24.19.0 |
| Periodo de ejecución | 2026-10-26, de 13:37 a 14:10 (America/Bogota) |
| Responsable | Cristian (gerente de pruebas y desarrollador), con ejecución de Claude Code |

## a) Alcance de las pruebas
**Se incluyó:**
- **Funciones de la API de las dos entregas:** FR-01 a FR-28, FR-30 a FR-33 y el registro tardío (ADR-010). Hay un caso trazado por requisito, con positivos y negativos, y la suite completa como respaldo (510 pruebas).
- **Calidad estática:** ESLint, tipos y compilación de producción.
- **Sistema en marcha:** `http://localhost:3001` con PostgreSQL de Docker, para humo, acceso por rol, cookie segura y rendimiento.
- **Usabilidad y accesibilidad de la PWA a 360 px** (inicio, Caja, entrada, cuenta de la habitación y navegación de la administración), más una exploración de 20 minutos.

**No se incluyó:**
- El VPS, la red privada (Tailscale), HTTPS, las copias cifradas y la recuperación (RPO/RTO): el TICKET-19 no se ha hecho.
- La carga concurrente: hay pocos usuarios y ningún requisito la pide.
- FR-29: está en espera por decisión del cliente.
- Safari para iPhone y celulares físicos: no hay dispositivos en el entorno.
- La aceptación con el personal y la dueña: queda planificada (CP-051 y CP-052), no ejecutada.
- La validez legal del aviso y de los plazos de conservación: le corresponde a un asesor.

## b) Resumen de pruebas
| Indicador | Manuales | Automatizadas | Total |
|---|---|---|---|
| Casos de prueba planificados | 11 | 41 | 52 |
| Casos de prueba ejecutados | 9 | 41 | 50 |
| Casos de prueba exitosos | 2 | 41 | 43 |
| Casos de prueba fallidos | 7 | 0 | 7 |
| Casos de prueba bloqueados | 0 | 0 | 0 |
| Casos de prueba no ejecutados | 2 | 0 | 2 |

Porcentaje de éxito sobre los ejecutados: 43 de 50 = **86 %**. Por tipo de prueba: funcional y de seguridad 100 % (41 de 41); usabilidad 22 % (2 de 9).

**Qué entra en cada columna:**
- **Automatizadas:** CP-001 a CP-041. Son 35 casos de la suite, 1 de calidad estática y 5 sobre el entorno en marcha.
- **Manuales:** CP-042 a CP-052. Incluye la inspección en el navegador asistida con scripts de medición: la ejecuta una persona o agente que observa, no la suite.

**Origen de las cifras automatizadas:** `resumen_resultados.py evidencias/resultados-suite.xml` dio 510 pruebas, 510 exitosas, 0 fallidas y 0 omitidas (`evidencias/resumen-suite.md`). Los 35 casos trazados se cruzaron por nombre con ese archivo: los 35 salieron exitosos (`evidencias/casos-automatizados-resultado.md`). Las pruebas sobre el entorno están en `evidencias/humo-entorno.json`: 5 de 5.

**Rendimiento medido** (CP-041, 200 solicitudes por API contra el sistema en marcha):

| API | p50 | p95 | Máximo | Límite del requisito no funcional |
|---|---|---|---|---|
| GET /habitaciones | 15,1 ms | 19,1 ms | 36,1 ms | p95 < 300 ms |
| GET /turnos/actual | 15,1 ms | 21,0 ms | 32,4 ms | p95 < 300 ms |
| POST /cotizaciones | 15,2 ms | 17,2 ms | 30,0 ms | p95 < 300 ms |

La confirmación en tiempo real llega en menos de 5 s (CP-012).

## c) Listado de defectos detectados
| Defecto | Título | Severidad | Estado | Caso |
|---|---|---|---|---|
| DEF-001 | En la Caja, «Salió plata» se sale de la tarjeta y la página se desplaza de lado a 360 px | Media | Abierto | CP-042 |
| DEF-002 | La entrada a medio llenar se pierde sin aviso al cambiar de pestaña o tocar «Volver» | Media | Abierto | CP-043 |
| DEF-004 | En el celular, la administración solo ve 3 de sus 6 pestañas | Media | Abierto | CP-045 |
| DEF-003 | Campos con letra de 14,5 px (zoom en el iPhone) | Baja | Abierto | CP-044 |
| DEF-005 | Controles más pequeños que 44 px | Baja | Abierto | CP-046 |
| DEF-006 | «Siguiente» a casi dos pantallas en el paso 1 de la entrada | Baja | Abierto | CP-047 |
| DEF-007 | El número de documento está bloqueado hasta elegir el tipo, sin explicación | Baja | Abierto | CP-050 |
| DEF-008 | La cuenta de una estadía vencida no lo dice | Baja | Abierto | CP-050 |

No hay defectos de severidad Crítica ni Alta.

Además se registraron dos incidencias que **no** son defectos del sistema:
- **INC-009:** el PRD se contradice sobre el documento del huésped. Se corrige el documento.
- **INC-010:** error del script de medición con los fondos degradados. Se corrigió el script.

## d) Conclusiones
- **¿Está listo para el uso previsto? Con condiciones.** La lógica de negocio está sólida y comprobada: el dinero, las horas de salida, los turnos y la caja, los permisos, la auditoría y la privacidad. Pasan todas las pruebas funcionales y de seguridad (510 de 510 en la suite y 41 de 41 casos), y el rendimiento queda muy por debajo del límite: p95 de 21 ms frente a 300 ms. Lo que falla es la **comodidad de uso en el celular**, que es justamente donde trabaja recepción y lo que más importa con una dueña que no sabe de tecnología.
- **Criterios de salida del plan:**
  - S1 se cumple: 50 casos ejecutados y 2 no ejecutados, con justificación.
  - S2 se cumple: no hay defectos Críticos ni Altos abiertos.
  - S3 se cumple: cada caso fallido tiene su incidencia y su defecto.
  - S4 se cumple con este informe y el plan de mejora.
- **Riesgos que quedan:**
  - Los tres defectos de severidad Media (DEF-001, DEF-002 y DEF-004) afectan el trabajo diario y conviene corregirlos **antes** de la sesión de práctica, para no enseñar algo que va a cambiar.
  - No se probó el sistema en el VPS ni por la red privada.
  - No se probó en un iPhone: DEF-003 se dedujo de la medida, no se observó.
- **Lo que no se pudo probar y su efecto:**
  - **La aceptación (CP-051 y CP-052).** Sin ella no hay aprobación para trabajar con huéspedes reales. También siguen pendientes la revisión legal del aviso y el plazo de conservación (HG-PRIV-002), que no son pruebas de software pero bloquean la salida a producción.
  - **El despliegue.** Hay que repetir CP-037 a CP-041 en el VPS al cerrar el TICKET-19.
- **Recomendaciones** (pasan al plan de mejora):
  1. Corregir DEF-001, DEF-002 y DEF-004.
  2. Ajustar la escala de tamaños: 16 px en los campos y 44 px en los controles táctiles (DEF-003 y DEF-005).
  3. Agregar la verificación a 360 px como prueba repetible.
  4. Hacer la práctica con el personal en celulares reales.
  5. Corregir el PRD (INC-009).
