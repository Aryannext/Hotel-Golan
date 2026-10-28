# 19: Desplegar el sistema en el VPS por la red privada

**ID:** TICKET-19
**Requisitos:** ADR-002, ADR-007; NFR de seguridad y recuperación; FR-21 (anonimización programada) (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature; auditoría HG-AUD-001, H-05)

**What to build:** El sistema completo (primera y segunda entrega, todas las migraciones de `db/migraciones/`: hoy de la 0001 a la 0011; antes decía «0001 a 0006») corre en el VPS de Cristian con Docker Compose. Solo se entra desde los equipos autorizados de Tailscale, con HTTPS (`tailscale serve`), y se instala como PWA en el celular. Arranca sin la semilla ficticia: con la cuenta de la administración y la configuración inicial del hotel. La anonimización programada corre en el servidor y la copia diaria cifrada funciona.

**Blocked by:** TICKET-01 (Iniciar sesión y ver el mapa de habitaciones). Antes de empezar, la revisión del VPS en solo lectura, cuando el usuario avise.

**Status:** ready-for-agent (después de la revisión del VPS)

## Paso 0 · Revisión del VPS (solo lectura; el usuario avisa cuándo)
- Entrar únicamente con la cuenta propia del usuario y la llave que él indique. No adivinar hosts ni llaves. Si el puerto 22 no responde, es el wifi: se espera.
- Mirar sin cambiar nada:
  - sistema operativo, RAM, disco y CPU;
  - si hay Docker y Compose;
  - si hay Tailscale;
  - puertos en uso y cortafuegos;
  - qué proyectos corren y cuánta memoria usan.
- Anotar los hallazgos en el RUNBOOK. Con eso se confirma ADR-002 y ADR-004 [V].

## Invariantes de negocio
- **VPS compartido:** convive con la cuenta de otra persona y con otros proyectos. No se tocan sus archivos, contenedores, puertos ni configuraciones. Cualquier cambio general (cortafuegos, Docker del sistema, actualizaciones) se decide con el usuario antes de hacerlo.
- **Ningún puerto público para el hotel:** el servicio escucha solo en la interfaz de Tailscale o en localhost detrás de `tailscale serve`. Valor anterior: «el cortafuegos solo admite la interfaz de Tailscale, SSH incluido». Se cambió porque cerrar el cortafuegos general afectaría a los otros proyectos; se decide con el usuario.
- **Secretos** solo en el `.env` del VPS, nunca en git.
- **Producción sin datos ficticios:**
  - la semilla sintética no corre;
  - se crea la primera cuenta de la administración con un PIN que el usuario pone en el servidor, nunca en el chat;
  - se cargan las tarifas, las reglas y el catálogo con los precios vigentes informados (HG-LEV-001 §§3, 9 y 24);
  - los precios de la vitrina los carga la administración en Ajustes.
- **Copias:** `pg_dump` → age → Google Drive, conservadas 30 días; la clave privada fuera del servidor.
- **Anonimización:** corre al arrancar y cada hora (FR-21).
- Importes en COP enteros; nada de dinero se borra (ADR-008). Reglas evaluadas en America/Bogota.

## Trabajo previo existente
- La rama local `ticket-19-despliegue-vps` (commit «arranque de producción y dirección de escucha») trae la carga inicial sin semilla, la dirección de escucha y `arranque.test.ts`.
- Esa rama sale de una versión vieja de main y choca con los cambios de la semilla de los TICKETS 20 a 25.
- **Actualización 27-10-2026 (HG-HAL-001):** el arranque sin semilla ya está en `main` por otro camino. Si se integra el PR #47:
  - `npm run db:iniciar` hace la carga inicial, y la semilla y `db:reiniciar` exigen `HOTEL_ENTORNO=desarrollo`;
  - existen `GET /api/v1/salud` y `npm start` para el servicio con reinicio automático.

  La rama `ticket-19-despliegue-vps` se puede descartar; lo que falta aquí es la infraestructura del VPS, las copias y el RUNBOOK.
- Primero hay que actualizarla desde main y revisar que la carga inicial incluya los grupos de la segunda entrega.

## Criterios de aceptación
- [ ] La revisión del VPS quedó anotada en el RUNBOOK (sistema, RAM, disco, Docker, Tailscale, puertos y proyectos existentes).
- [ ] Desde un celular autorizado se abre la PWA por HTTPS y se instala; desde fuera de la red privada no responde.
- [ ] Al arrancar en limpio no hay usuarios ni huéspedes ficticios: solo la cuenta de la administración y la configuración inicial.
- [ ] Los otros proyectos del VPS siguen funcionando igual que antes del despliegue.
- [ ] Existe una copia cifrada del día, y se restaura en una base temporal (ensayo corto; el ensayo completo de RTO y RPO es de la Fase 4).
- [ ] El registro del servidor muestra que la anonimización programada corrió.
- [ ] Los pasos están en un borrador de RUNBOOK: instalar, actualizar, restaurar y qué hacer si se cae.

## Módulos a tocar
infraestructura (docker-compose de producción, Tailscale, copias), arranque de producción (carga inicial sin semilla), documentación de operación (RUNBOOK).

## Verificación
- Desde un celular dentro de la red privada, abrir la URL `*.ts.net`; desde fuera, no debe haber respuesta.
- Restaurar la copia en una base temporal y contar las filas.
- Correr `npm test -- --test-name-pattern="arranque"` en la rama actualizada.

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
