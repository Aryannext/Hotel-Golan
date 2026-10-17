# Calidad y seguridad en GitHub

## Herramientas

| Control | Qué comprueba | Cuándo se ejecuta |
|---|---|---|
| ESLint + TypeScript | Errores comunes, variables sin uso y tipos de API y web | PR a `main`, push a `main`, ejecución manual |
| `node:test` + cobertura LCOV | Pruebas de API, reglas, migraciones, semilla y lógica web con PGlite | CI |
| Vite | Compilación real de la web para producción | CI |
| CodeQL `security-extended` | Vulnerabilidades en JavaScript/TypeScript y GitHub Actions | PR, push, semanal y manual |
| Dependency Review | Dependencias nuevas con vulnerabilidades moderadas o superiores | PR a `main` |
| `npm audit` | Vulnerabilidades moderadas o superiores en todo el lockfile, incluido desarrollo | PR, push, semanal y manual |
| Gitleaks | Secretos en commits; checkout con historial completo | PR, push, semanal y manual |
| actionlint | Sintaxis, expresiones y comandos shell de los workflows | PR, push, semanal y manual |
| Zizmor | Permisos, inyecciones y configuración insegura de Actions | PR, push, semanal y manual |
| Dependabot | PR de actualizaciones para npm y Actions | Lunes, 08:00, America/Bogota, tras integrar su configuración a `main` |

SonarQube Cloud ya analiza mediante su GitHub App. Se conserva ese análisis automático para evitar dos análisis competidores del mismo proyecto. Gitar se gestiona desde su GitHub App; estos workflows no requieren su token ni cambian su instalación. La ejecución de Gitar debe comprobarse en un PR desde su propia aplicación, ya que no aparece como check en el PR inicial.

## Uso local

```bash
npm ci --ignore-scripts
npm run lint
npm run tipos
npm run test:coverage
npm run web:build
npm audit --audit-level=moderate
```

Las pruebas usan datos sintéticos y PGlite en memoria. No necesitan `.env`, Docker, PostgreSQL externo ni secretos de producción. Las pruebas de Server-Sent Events abren una conexión HTTP local. `npm ci --ignore-scripts` instala las dependencias exactas del lockfile sin ejecutar scripts de instalación; las dependencias nativas actuales incluyen paquetes precompilados y se verifican con las pruebas y el build.

El job `Calidad y pruebas` guarda `coverage/lcov.info` como artefacto durante 14 días. No se ha fijado un umbral arbitrario de cobertura. El LCOV se genera a partir de los módulos cargados por las pruebas; no mide automáticamente archivos nunca importados, como todos los componentes visuales. Las pruebas web actuales cubren lógica, no navegación completa de navegador.

El análisis automático de SonarQube Cloud no descarga este artefacto. Para importar cobertura allí, habrá que migrar a análisis por CI, desactivar primero Automatic Analysis y configurar `SONAR_TOKEN` y los identificadores reales del proyecto; no se deja un workflow incompleto dependiente de esos secretos.

## Seguridad de los workflows

Las acciones se fijan a SHA completo, con comentarios de versión, y Dependabot propone sus actualizaciones. Las actualizaciones de versión esperan siete días desde su publicación; las correcciones de seguridad no tienen esa espera. El token tiene solo lectura salvo `security-events: write` en CodeQL. Checkout no conserva credenciales, no se usa `pull_request_target` y los jobs tienen límites de tiempo y cancelación de ejecuciones anteriores. Los workflows no publican comentarios en los PR.

actionlint está fijado a 1.7.12 y su archivo Linux se verifica contra un SHA-256 obtenido de la release oficial. Dependabot no actualiza ese binario: al actualizarlo, cambie conjuntamente `ACTIONLINT_VERSION` y `ACTIONLINT_SHA256` después de verificar la release oficial. Zizmor opera en modo bloqueante, con anotaciones en el job; CodeQL publica sus resultados en Security.

Gitleaks Action es gratuito sin clave para repositorios de cuentas personales, como este. Si se transfiere el repositorio a una organización, revise sus condiciones y configure `GITLEAKS_LICENSE` o sustituya la acción por el CLI. La acción seleccionada usa Node.js 24. No se permiten falsos positivos por carpetas completas: cualquier excepción futura debe identificar el hallazgo concreto y explicar su motivo.

## Atender resultados

- **ESLint, tipos, tests o build:** corregir la causa y repetir los comandos locales. No desactivar el check para conseguir un resultado verde.
- **Dependencias:** revisar el aviso y actualizar el lockfile mediante un PR. No ejecutar `npm audit fix --force` sin evaluar cambios incompatibles. Dependabot no fusiona PR automáticamente.
- **Secretos:** revocar o rotar primero; revisar exposición e historial. No subir logs o reportes con la credencial completa.
- **CodeQL o SonarQube:** revisar la alerta y el flujo de datos; documentar cualquier falso positivo en la herramienta.
- **Workflows:** corregir permisos, versiones, sintaxis o uso de entradas no confiables.

## Configuración del repositorio

Las alertas de Dependabot y sus correcciones de seguridad se habilitan en Settings → Security. Secret scanning y push protection ya estaban activos. Los reportes privados se reciben en Security → Advisories.

Para proteger `main`, exija PR, resolución de conversaciones y los checks `Calidad y pruebas`, `Dependencias nuevas`, `Auditoría npm`, `Secretos (Gitleaks)`, `Workflows (actionlint y Zizmor)`, ambos `Analyze (...)` y `SonarCloud Code Analysis`. El check adicional `CodeQL` refleja los resultados de code scanning y también debe pasar. Verifique primero que esos nombres aparezcan y pasen en el PR. En un repositorio con un único mantenedor, no exija una aprobación que el autor no puede darse a sí mismo. `CODEOWNERS` identifica al responsable de cambios en automatización y dependencias.

Los análisis semanales y las actualizaciones de Dependabot empiezan cuando los workflows están en la rama predeterminada. No se han añadido herramientas que necesiten nuevas cuentas o planes pagos.

## Referencias oficiales

- [Seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [Dependency Review](https://github.com/actions/dependency-review-action)
- [Gitleaks Action](https://github.com/gitleaks/gitleaks-action)
- [actionlint](https://github.com/rhysd/actionlint)
- [Zizmor Action](https://github.com/zizmorcore/zizmor-action)
