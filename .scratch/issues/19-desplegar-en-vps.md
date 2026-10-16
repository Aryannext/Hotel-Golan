# 19: Desplegar el esqueleto en el VPS por la red privada

**ID:** TICKET-19
**Requisitos:** ADR-002, ADR-007; NFR de seguridad y recuperación (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** El esqueleto (inicio de sesión y mapa) corre en el VPS de Cristian con Docker Compose, accesible solo desde los equipos autorizados de Tailscale, con HTTPS (`tailscale serve`), instalable como PWA en el celular, y con la copia diaria cifrada funcionando.

**Blocked by:** TICKET-01 (Iniciar sesión y ver el mapa de habitaciones)

**Status:** ready-for-agent

## Invariantes de negocio
- Ningún puerto público: el cortafuegos solo admite la interfaz de Tailscale, SSH incluido.
- Los secretos solo en `.env` del VPS; nunca en git.
- Copias `pg_dump` → age → Google Drive, conservadas 30 días; la clave privada fuera del servidor.
- Antes de empezar, confirmar la RAM y el sistema operativo del VPS y los límites del plan de Tailscale [V].
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] Desde un celular autorizado se abre la PWA por HTTPS y se instala; desde fuera de la red privada no responde.
- [ ] Existe una copia cifrada del día y se restaura en una base temporal (ensayo corto; el ensayo completo de RTO y RPO es de la Fase 4).
- [ ] Se documentan los pasos en un borrador de RUNBOOK.

## Módulos a tocar
infraestructura (docker-compose de producción, Tailscale, copias), documentación de operación.

## Verificación
`desde un celular dentro de la red privada: abrir la URL *.ts.net; desde fuera: no hay respuesta; restaurar la copia en una base temporal y contar las filas.`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
