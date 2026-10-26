# Ejecución de pruebas — Sistema de recepción del Hotel Golán

Versión: `main` en `dbd24b3` (ver `evidencias/version.txt`). Fecha de ejecución: 2026-10-26 (America/Bogota).

## 1. Calendario de ejecución
| Orden | Casos | Fecha planificada | Responsable |
|---|---|---|---|
| 1 | CP-001 a CP-035 (suite automatizada) | 2026-10-26 | Claude Code (para Cristian) |
| 2 | CP-036 (ESLint, tipos y compilación) | 2026-10-26 | Claude Code |
| 3 | CP-037 a CP-041 (humo, seguridad y rendimiento sobre el entorno) | 2026-10-26 | Claude Code |
| 4 | CP-042 a CP-050 (usabilidad y exploratoria a 360 px) | 2026-10-26 | Claude Code |
| 5 | CP-051 y CP-052 (aceptación con personas) | Después del TICKET-19 | Cristian con el personal y la dueña |

## 2. Verificación del entorno
| Comprobación | Resultado | Evidencia |
|---|---|---|
| Versión del código | `main` en `dbd24b3` (merge del PR #38); Node v24.19.0 | `evidencias/version.txt` |
| Base de datos del entorno | Contenedor `hotel-golan-db-1` activo y sano (PostgreSQL 16, puerto 5433) | `docker ps` el 2026-10-26 |
| API y PWA en marcha | `http://localhost:3001` responde 200 con el HTML del sistema | CP-037, `evidencias/humo-entorno.json` |
| PWA compilada | `npm run web:build` correcto | `evidencias/salida-build.txt` |
| Base de las pruebas automatizadas | PGlite en memoria con las migraciones 0001 a 0010 y la semilla | `evidencias/salida-suite.txt` |

## 3. Datos de prueba integrados
- **Pruebas automatizadas:** cada archivo de pruebas carga la semilla sintética con `crearEntorno()`: 12 habitaciones, 8 tarifas, reglas, 6 usuarios, catálogo, un turno de noche abierto y dos estadías («Huésped Prueba 01» en la 205 y «Huésped Prueba 02» en la 211). Las pruebas agregan sus propios huéspedes sintéticos («Huésped Prueba NN», «Ana Prueba Sintética», documentos «PRUEBA…»).
- **Entorno en :3001:** la base de Docker con la misma semilla sintética. Durante la usabilidad se escribió el nombre «Huésped Prueba CF35» en el asistente, sin guardarlo (el asistente lo perdió; ver CP-043).
- No se usaron datos reales de personas.

## 4. Criterios de entrada
| Criterio (del plan) | ¿Se cumple? | Observación |
|---|---|---|
| E1. Compila y la suite corre | Sí | 510 pruebas ejecutadas; ESLint, tipos y compilación sin errores |
| E2. El sistema responde en :3001 con la base migrada | Sí | CP-037 exitoso |
| E3. Existen los datos sintéticos y los usuarios pueden entrar | Sí | CP-039: `recepcion1` entra; `recepcion2` y `admin` también se usaron en el navegador |
| E4. Requisitos de referencia disponibles | Sí | PRD v0.7, CONTRATO_API v0.5.2 y TESTS_ACEPTACION v0.5.3 |

## 5. Registro de ejecución
| Caso | Fecha y hora | Ejecutado por | Resultado obtenido | Estado | Incidencia | Evidencia |
|---|---|---|---|---|---|---|
| CP-001 a CP-035 | 2026-10-26 13:37–13:38 | Claude Code (`node --test`) | Las 35 pruebas que cubren estos casos pasaron. Detalle por caso en la evidencia. | Exitoso (35) | — | `evidencias/casos-automatizados-resultado.md`, `resultados-suite.xml` |
| CP-036 | 2026-10-26 13:38 | Claude Code | `npm run lint` (salida 0, `--max-warnings=0`); `npm run tipos` (salida 0); `npm run web:build` (salida 0) | Exitoso | — | `evidencias/salida-lint.txt`, `salida-tipos.txt`, `salida-build.txt` |
| CP-037 | 2026-10-26 13:56 | Claude Code | 200, título «Hotel Golán · Sistema de recepción» | Exitoso | — | `evidencias/humo-entorno.json` |
| CP-038 | 2026-10-26 13:56 | Claude Code | 401 `CREDENCIALES_INVALIDAS`, sin cookie | Exitoso | — | ídem |
| CP-039 | 2026-10-26 13:56 | Claude Code | 201; HttpOnly, Secure, SameSite=Strict; Max-Age 43200 (12 h) | Exitoso | — | ídem |
| CP-040 | 2026-10-26 13:56 | Claude Code | Sin sesión 401; /usuarios 403; habitaciones 200 con 12 | Exitoso | — | ídem |
| CP-041 | 2026-10-26 13:56 | Claude Code | p95: GET /habitaciones 19,1 ms; GET /turnos/actual 21 ms; POST /cotizaciones 17,2 ms (máximo 36,1 ms) | Exitoso | — | `evidencias/salida-humo-entorno.txt` |
| CP-042 | 2026-10-26 13:58 | Claude Code (navegador, 360 px) | «Salió plata» termina en x = 418 px, con la tarjeta hasta 344 px; documento de 418 px de ancho: la página se desplaza de lado | Fallido | INC-001 | `evidencias/usabilidad-360px.md`, `DEF-001-caja-360px.jpg` |
| CP-043 | 2026-10-26 14:00 | Claude Code (navegador) | Al tocar «Caja» y volver, el nombre escrito quedó vacío; no hubo aviso | Fallido | INC-002 | `evidencias/usabilidad-360px.md` |
| CP-044 | 2026-10-26 13:59 | Claude Code (navegador) | Los 5 campos del paso 1 miden 14,5 px | Fallido | INC-003 | ídem |
| CP-045 | 2026-10-26 14:02 | Claude Code (navegador, `admin`) | Se ven 3 de 6 pestañas; «Historial» cortada; «Equipo» y «Ajustes» fuera de la pantalla, sin señal de que existen | Fallido | INC-004 | ídem |
| CP-046 | 2026-10-26 13:58–14:03 | Claude Code (navegador) | Por debajo de 44 px: pestañas de 36 px; campana de 38; «Agregar», «Registrar pago» y «Daño» de 24; anular de 32; botones de la cuenta de 42 | Fallido | INC-005 | ídem |
| CP-047 | 2026-10-26 13:59 | Claude Code (navegador) | «Siguiente» empieza en y = 1488 px, con 780 px de ventana: 1,91 pantallas | Fallido | INC-006 | ídem |
| CP-048 | 2026-10-26 13:58 | Claude Code (navegador) | Ningún texto por debajo de 4,5:1 en el inicio ni en la Caja | Exitoso | INC-010 (nota del método) | ídem |
| CP-049 | 2026-10-26 13:58 | Claude Code (navegador) | 0 botones sin nombre y 0 campos sin etiqueta | Exitoso | — | ídem |
| CP-050 | 2026-10-26 13:59–14:03 | Claude Code (navegador) | Dos hallazgos: el número de documento está bloqueado hasta elegir el tipo, sin explicación; la cuenta de la 205 no dice que la salida se venció | Fallido | INC-007, INC-008 | ídem |
| CP-051 | — | — | No se ejecutó: depende del despliegue en el VPS (TICKET-19) y de la disponibilidad del personal | No ejecutado | — | Plan HG-GUIA-002 |
| CP-052 | — | — | No se ejecutó: depende de CP-051 y del tiempo de la dueña | No ejecutado | — | — |

Durante el análisis de los documentos de referencia apareció un hallazgo que no viene de ningún caso: el PRD se contradice sobre el documento del huésped. Se registra como INC-009.

## 6. Ejecución automatizada
Comando:

```bash
node --test --test-reporter=junit --test-reporter-destination=pruebas/evidencias/resultados-suite.xml \
  --test-reporter=spec --test-reporter-destination=pruebas/evidencias/salida-suite.txt \
  "src/**/*.test.ts" scripts/verificar-local.test.ts
```

Duración: 42 s (de 13:37:04 a 13:37:47). Salida: 0.

Resultado según `resumen_resultados.py resultados-suite.xml`:

| Indicador | Automatizadas |
|---|---|
| Pruebas ejecutadas | 510 |
| Exitosas | 510 |
| Fallidas | 0 |
| Omitidas | 0 |
| Porcentaje de éxito sobre las ejecutadas | 100,0 % |

Pruebas sobre el entorno: `node pruebas/humo-entorno.ts`, con salida 0 y 5 de 5 exitosas (`evidencias/salida-humo-entorno.txt`).
