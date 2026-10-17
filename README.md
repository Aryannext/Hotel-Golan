# Hotel Golán — sistema de recepción

Sistema de recepción para un hotel pequeño de 12 habitaciones en Florencia (Caquetá, Colombia): habitaciones, estadías, caja por turno y confirmación de transferencias en tiempo real.

**Todos los datos de este repositorio son sintéticos** (huéspedes «Huésped Prueba NN», documentos `PRUEBA…`, usuarios `recepcion1`…`recepcion4`, `admin`, `duena`). Ningún dato real de huéspedes se usa en el código, en las pruebas ni en herramientas de IA (Circular SIC 002 de 2024).

## Qué hace (primera entrega)
- **Recepción:** recibir y entregar el turno con conteo; registrar entradas (asistente de 3 pasos con autorización de datos); cobros en efectivo, Nequi o Bancolombia; consumos de nevera, llave y recargo de aseo; extender la estadía (regla de las 4:00 p. m.); dar salida solo con la cuenta en $0; desistimiento y devolución; revisar, limpiar o mandar a mantenimiento las habitaciones; salidas de dinero de la caja.
- **Administración:** confirmar transferencias con un toque desde el celular; anular cobros o salidas con motivo (sin borrar nada); consultar el historial de turnos, sus movimientos y el resumen diario de 6:30 a. m. a 6:30 a. m. (hora de Colombia); agregar personas, cambiar su PIN, desbloquearlas o desactivarlas, y ver quién hizo cada acción (sin datos de huéspedes); cambiar tarifas, reglas y productos, que aplican solo a lo nuevo.
- **Avisos:** campana y «Pendientes» con salidas vencidas (corre el valor por hora), transferencias por verificar y habitaciones por revisar o en limpieza.
- **Tiempo real:** los cambios llegan a las demás pantallas por Server-Sent Events.
- **Privacidad:** una tarea borra nombre, documento y teléfono de los huéspedes a los 90 días de la salida (plazo configurable, por confirmar con el hotel); se conservan los importes. También se puede correr a mano con `npm run privacidad:anonimizar`.

El avance por ticket está en [`.scratch/issues/`](.scratch/issues/README.md).

## Tecnología
- Node.js 24 LTS, que ejecuta TypeScript directamente sin compilar (ADR-001).
- API: Fastify 5 · PostgreSQL 16 (PGlite en memoria para las pruebas).
- PWA: Preact + Vite.
- Pruebas: `node:test`, con desarrollo guiado por pruebas (TDD).

## Primeros pasos
```bash
npm install
cp .env.example .env          # cambie las contraseñas
docker compose up -d db       # si el puerto 5432 está ocupado, use 5433 en .env
npm run db:migrar
npm run db:sembrar            # datos sintéticos; solo contra 127.0.0.1
npm run web:build             # compila la PWA en dist/web
npm run api:dev               # API y PWA en http://127.0.0.1:3000
```

## Pruebas
```bash
npm test                      # todas las pruebas (API, reglas y lógica de la PWA), en PGlite: no necesitan Docker
npm run tipos                 # revisión de tipos con tsc
npm run db:verificar          # migración + semilla + restricciones + simulador
npm run lint                  # ESLint para TypeScript y configuración
npm run test:coverage         # pruebas y reporte coverage/lcov.info
```

## Calidad y seguridad automatizadas

GitHub Actions valida código, tipos, pruebas con cobertura y compilación; CodeQL, Dependency Review, npm audit, Gitleaks, actionlint y Zizmor revisan seguridad. Dependabot propone actualizaciones de npm y Actions. SonarQube Cloud conserva su integración actual. La configuración, los límites de cobertura y cómo resolver fallos están en [docs/automatizacion.md](docs/automatizacion.md).

## Estructura
| Ruta | Contenido |
|---|---|
| `src/api/reglas/` | Reglas del hotel, puras y sin base de datos: salida por franjas, tarifas, descuento, extensiones, fin del turno |
| `src/api/` | API por módulos: identidad, habitaciones, estadías, cobros, caja, configuración, tiempo real |
| `src/web/` | PWA (Preact): pantallas y lógica de presentación probada |
| `db/migraciones/` | Esquema SQL versionado (PostgreSQL 16) |
| `scripts/` | Comandos de npm, acceso a datos, semilla sintética y simulador de verificación |
| `docker-compose.yml`, `.env.example` | Infraestructura mínima y variables documentadas |

## Reglas para trabajar en este repositorio
- **Datos:** solo sintéticos. Nunca datos reales de huéspedes.
- **Dinero:** en pesos enteros (COP). No se borra nada; se anula con usuario y motivo.
- **Reglas de negocio:** vienen del PRD aprobado y no se inventan. Si falta una regla, se pregunta.
- **Secretos:** nunca en el repositorio; van en `.env`, que está ignorado por git.
