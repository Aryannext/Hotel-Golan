# Pruebas del sistema (formato SENA CF35)

Evidencias de la aplicación de pruebas del 2026-10-26 sobre `main` en `dbd24b3`. Todos los datos son sintéticos.

| Entregable | Archivo |
|---|---|
| 1. Plan de pruebas | [01-plan-de-pruebas.md](01-plan-de-pruebas.md) |
| 2. Casos de prueba (52) | [02-casos-de-prueba.md](02-casos-de-prueba.md) |
| 3. Ejecución | [03-ejecucion.md](03-ejecucion.md) |
| 4. Incidencias | [04-incidencias.md](04-incidencias.md) |
| 5. Defectos (uno por archivo) | [05-defectos/](05-defectos/) |
| 6. Informe de resultados | [06-informe-de-resultados.md](06-informe-de-resultados.md) |
| 7. Plan de mejora | [07-plan-de-mejora.md](07-plan-de-mejora.md) |
| Evidencias | [evidencias/](evidencias/) |

## Cómo repetir lo automatizado
```bash
node --test --test-reporter=junit --test-reporter-destination=pruebas/evidencias/resultados-suite.xml "src/**/*.test.ts" scripts/verificar-local.test.ts
node pruebas/humo-entorno.ts http://localhost:3001
```
`humo-entorno.ts` solo inicia sesión y consulta: no registra entradas ni cobros. Usa los usuarios y el PIN de la semilla sintética.
