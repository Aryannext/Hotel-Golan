# Hotel Golán — sistema de recepción

Código de la primera entrega: caja, transferencias y habitaciones.

**Especificación aprobada** (Puertas G0 y G1). Está en la carpeta de documentación, en OneDrive:
`C:\Users\crist\OneDrive\Documentos\Hotel Golán\docs\`
- `PRD.md` — requisitos (FR) y reglas del hotel (RN)
- `ARQUITECTURA.md` — modelo de datos y flujos
- `CONTRATO_API.yaml` — contrato OpenAPI
- `TESTS_ACEPTACION.feature` — criterios de aceptación
- `ADR.md` — decisiones de arquitectura

## Requisitos
- Node.js 24 LTS (ADR-001). Ejecuta TypeScript directamente, sin compilar.
- Docker con Compose, solo para PostgreSQL local o en el VPS (ADR-004).

## Primeros pasos
```bash
npm install
cp .env.example .env          # cambie las contraseñas
docker compose up -d db
npm run db:migrar
npm run db:sembrar            # datos sintéticos; solo contra 127.0.0.1
```

## Verificar sin Docker
```bash
npm run db:verificar          # migración + semilla + restricciones + simulador, en PGlite (memoria)
npm run tipos                 # revisión de tipos con tsc
```

## Simular la confirmación de transferencias (opción B)
```bash
npm run simular:verificacion                       # lista los pagos por verificar
npm run simular:verificacion -- <pago_id> LLEGO    # o NO_LLEGO
```

## Estructura
| Ruta | Contenido |
|---|---|
| `db/migraciones/` | Esquema SQL versionado (PostgreSQL 16) |
| `scripts/lib/` | Acceso a datos, migraciones, semilla y la regla de verificación (Inbox/Outbox, ADR-011) |
| `scripts/*.ts` | Comandos de npm |
| `docker-compose.yml`, `.env.example` | Infraestructura mínima y variables documentadas |

## Reglas para trabajar en este repositorio
- **Datos:** solo datos sintéticos. Nunca datos reales de huéspedes, ni en pruebas ni en herramientas de IA (Circular SIC 002 de 2024).
- **Dinero:** en pesos enteros (COP). No se borra nada; se anula con motivo.
- **Reglas de negocio:** se toman del PRD y no se inventan. Si falta una regla, se pregunta.
