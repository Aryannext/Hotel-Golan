# Plan de pruebas — Sistema de recepción del Hotel Golán

| Campo | Valor |
|---|---|
| Sistema y versión | Sistema de recepción Hotel Golán (PWA + API) · `main` en el commit `dbd24b3` (PR #38) |
| Responsable | Cristian (desarrollador y analista), con apoyo de Claude Code |
| Fecha | 2026-10-26 |
| Formato | SENA CF35 «Aplicación de pruebas de software» |

## 1. Objetivo
Saber si el sistema cumple los requisitos funcionales de la primera y la segunda entrega (FR-01 a FR-33) y los no funcionales del PRD (rendimiento, seguridad y usabilidad en celular desde 360 px). También se buscan los problemas de uso que vio la revisión UX/UI del 2026-10-26, antes de la sesión de práctica con el personal y del despliegue en el VPS (TICKET-19).

## 2. Alcance
**Incluye:**
- API REST: sesiones, habitaciones, estadías, cargos, pagos, caja y turnos, anulaciones, usuarios y auditoría, configuración, ventas, lavandería, facturas, migración y anonimización;
- aplicación web (PWA): inicio de recepción, nueva entrada, cuenta de la habitación, Caja y navegación de la administración;
- calidad estática: ESLint, tipos de TypeScript y compilación de producción;
- el sistema en marcha en `http://localhost:3001` (humo, seguridad y rendimiento);
- usabilidad a 360 px.

**No incluye:**
- **Despliegue en el VPS, Tailscale, HTTPS de la red privada, copias cifradas y recuperación (RPO/RTO).** El TICKET-19 todavía no se ha hecho y no hay entorno donde probarlos.
- **Carga concurrente.** El hotel tiene 12 habitaciones y entre 1 y 3 usuarios a la vez; se mide la latencia en serie, no la carga.
- **Archivo para el contador (FR-29).** Está en espera por decisión del cliente.
- **Navegadores distintos de Chromium y celulares físicos.** No hay dispositivos en el entorno de pruebas (riesgo R3).
- **Validez legal del aviso de privacidad y de los plazos.** Le corresponde a un asesor, no a las pruebas de software.

## 3. Requerimientos de referencia
- `docs/PRD.md` (HG-PRD-001 v0.7): FR-01 a FR-33, RN-01 a RN-24 y la sección 5 (requisitos no funcionales).
- `docs/TESTS_ACEPTACION.feature` v0.5.3: escenarios Gherkin de aceptación.
- `docs/CONTRATO_API.yaml` v0.5.2: contrato OpenAPI.
- ADR-003 (sesión y PIN) y ADR-010 (registro tardío).
- La revisión UX/UI del 2026-10-26 (skill `ui-ux-pro-max`), que da los criterios de usabilidad. Estos se apoyan en el requisito no funcional de usabilidad («pantallas para celular desde 360 px, en español sencillo; las acciones de dinero se confirman y muestran un resultado claro»). Algunos criterios **se derivan de guías de diseño, no del cliente**: 44 px como tamaño táctil y 16 px en los campos. Así se indica en cada caso.

## 4. Tipos de prueba seleccionados
| Cuadrante | Tipo de prueba | ¿Aplica? | Justificación | Herramienta | Manual o automatizada |
|---|---|---|---|---|---|
| Q1 | Unitarias y de componentes (reglas puras, lógica de la PWA) | Sí | Las reglas de dinero y de horas (RN-01 a RN-05) son la parte más delicada; ya existen y se ejecutan como línea base. | `node:test` (Node 24) | Automatizada |
| Q1 | Calidad estática | Sí | Un error de tipos o de compilación impide el despliegue. | ESLint, `tsc`, Vite | Automatizada |
| Q2 | Funcionales de la API e historias de usuario (positivas y negativas) | Sí | Es el grueso del sistema: cada FR tiene un caso con su prueba automatizada (PGlite con la semilla sintética). | `node:test` + `app.inject` | Automatizada |
| Q2 | Humo sobre el sistema en marcha | Sí | Confirma que la versión servida con PostgreSQL real responde igual que en las pruebas. | `pruebas/humo-entorno.ts` | Automatizada |
| Q3 | Usabilidad e inspección en el navegador a 360 px | Sí | La usuaria principal no sabe de tecnología y recepción usa el celular (requisito no funcional de usabilidad). | Panel de navegador + scripts de medición | Manual asistida |
| Q3 | Exploratoria (nueva entrada y cuenta de la habitación) | Sí | Son los flujos de más uso; la exploración encuentra lo que no previó ningún requisito. | Navegador | Manual |
| Q3 | Aceptación con el personal y con la dueña | Sí, pendiente | La aprobación la da la dueña (HG-ACT-001 V6-07); la práctica está planeada en HG-GUIA-002. | Sesión presencial | Manual |
| Q4 | Rendimiento (latencia) | Sí | El requisito no funcional pide p95 menor de 300 ms en las API de consulta. | `pruebas/humo-entorno.ts` (200 solicitudes por API) | Automatizada |
| Q4 | Seguridad (acceso por rol, cookie, bloqueo, auditoría) | Sí | Hay datos personales de huéspedes y dinero (ADR-003, Ley 1581). | `node:test` + humo | Automatizada |
| Q4 | Carga y estrés | No | Hay pocos usuarios a la vez; no hay un requisito que lo pida. | — | — |

## 5. Entorno de pruebas
- **Equipo:** Windows 11 Home y Node.js 24.19.0.
- **Pruebas automatizadas:** PostgreSQL en memoria (PGlite) con el esquema real y la semilla sintética. Cada archivo de pruebas crea su propia base.
- **Sistema en marcha:** `http://localhost:3001` (`npm run api:dev`), con PostgreSQL 16 en Docker (contenedor `hotel-golan-db-1`) y la PWA compilada en `dist/web`.
- **Navegador:** panel de Claude (Chromium), emulando 360 × 780 px y 375 × 812 px, y a 1280 px para la vista de computador.
- **Datos de prueba:** la semilla sintética, con usuarios `recepcion1` a `recepcion4`, `admin` y `duena`, huéspedes «Huésped Prueba NN» y documentos «PRUEBA…». No se usan datos reales de personas. El PIN de prueba es el de la semilla (`src/api/pruebas/entorno.ts`) y no se copia en estos documentos.

## 6. Criterios de entrada
- E1. El código de `main` compila y la suite automatizada corre.
- E2. El sistema responde en `http://localhost:3001` con la base de Docker migrada (0001 a 0010).
- E3. Existen los datos de prueba sintéticos (semilla) y los usuarios de prueba pueden iniciar sesión.
- E4. Los requisitos de referencia están disponibles (PRD v0.7, contrato, escenarios Gherkin).

## 7. Criterios de salida
- S1. El 100 % de los casos planificados queda ejecutado, o justificado como «Bloqueado» o «No ejecutado».
- S2. Ningún defecto de severidad Crítica o Alta queda abierto.
- S3. Cada caso fallido tiene su incidencia y, si es un fallo del sistema, su reporte de defecto.
- S4. El informe de resultados y el plan de mejora quedan escritos.

## 8. Calendario
| Actividad | Inicio | Fin | Responsable |
|---|---|---|---|
| Plan y casos de prueba | 2026-10-26 | 2026-10-26 | Cristian / Claude Code |
| Línea base automatizada (suite, ESLint, tipos y compilación) | 2026-10-26 13:37 | 2026-10-26 13:38 | Claude Code |
| Humo, seguridad y rendimiento sobre el entorno | 2026-10-26 13:45 | 2026-10-26 14:10 | Claude Code |
| Usabilidad y exploratoria a 360 px | 2026-10-26 13:40 | 2026-10-26 14:05 | Claude Code |
| Aceptación con el personal y la dueña | después del TICKET-19 | por definir | Cristian con Derly y recepción |
| Incidencias, defectos, informe y plan de mejora | 2026-10-26 | 2026-10-26 | Cristian / Claude Code |

## 9. Riesgos de las pruebas
| Riesgo | Efecto | Mitigación |
|---|---|---|
| R1. Las pruebas funcionales corren sobre PGlite, no sobre el PostgreSQL del servidor. | Puede haber diferencias de comportamiento entre las dos bases. | Prueba de humo sobre el sistema con PostgreSQL de Docker (CP-037 a CP-041). |
| R2. El entorno es local, no el VPS. | No se prueban la red privada, HTTPS ni la latencia real por Tailscale. | Repetir CP-037 a CP-041 en el VPS al cerrar el TICKET-19. |
| R3. La usabilidad se mide en un Chromium emulado. | Puede haber diferencias en Safari para iPhone, como el zoom de los campos, o en celulares de gama baja. | Probar en los celulares reales del hotel durante la sesión de práctica. |
| R4. La aceptación depende del tiempo de la dueña y del personal. | Sin aceptación no hay salida a producción. | Se registra como «No ejecutado» y se agenda con la guía HG-GUIA-002. |
| R5. La prueba de humo escribe en la base local (un intento fallido de PIN). | Suma un intento fallido a `recepcion1`. | El inicio de sesión correcto que viene enseguida reinicia el contador (CP-039). |
