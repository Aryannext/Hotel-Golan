# Tickets — primera entrega (caja, transferencias y habitaciones)

Fase 2 del pipeline AI-SDLC (16-10-2026). Aprobados por el usuario. Se trabaja la **frontera**: cualquier ticket cuyos bloqueos ya estén terminados.

| Ticket | Título | Bloqueado por | Estado |
|---|---|---|---|
| [TICKET-01](01-iniciar-sesion-y-mapa.md) | Iniciar sesión y ver el mapa de habitaciones | — | **done** |
| [TICKET-02](02-cotizar-estadia.md) | Cotizar una estadía (precio y hora de salida) | 01 | **done** |
| [TICKET-03](03-recibir-turno-y-ver-caja.md) | Recibir el turno y ver la caja | 01 | **done** |
| [TICKET-04](04-entrada-en-efectivo.md) | Registrar una entrada pagada en efectivo | 02, 03 | **done** |
| [TICKET-05](05-transferencia-y-confirmacion-en-vivo.md) | Transferencia por verificar y confirmación en tiempo real | 04 | **done** |
| [TICKET-06](06-cargos-y-pagos-en-la-cuenta.md) | Cargos y pagos en la cuenta de la habitación | 04 | **done** |
| [TICKET-07](07-extender-estadia.md) | Extender la estadía con la regla de las 4 p. m. | 02, 06 | **done** |
| [TICKET-08](08-salida-y-revision.md) | Dar salida y revisar la habitación | 06 | **done** |
| [TICKET-09](09-desistimiento-y-devolucion.md) | Desistimiento y devolución | 05 | **done** |
| [TICKET-10](10-salidas-de-dinero.md) | Salidas de dinero de la caja | 03 | **done** |
| [TICKET-11](11-entregar-turno.md) | Entregar el turno con conteo | 10 | **done** |
| [TICKET-12](12-anulaciones.md) | Anulaciones (administración) | 06, 10 | **done** |
| [TICKET-13](13-historial-y-dia-del-hotel.md) | Historial de turnos y resumen por día del hotel | 11 | **done** |
| [TICKET-14](14-usuarios-pin-y-auditoria.md) | Usuarios, PIN y auditoría (administración) | 01 | **done** |
| [TICKET-15](15-configuracion-tarifas-y-catalogo.md) | Configuración: tarifas, reglas y catálogo | 02, 06 | **done** |
| [TICKET-16](16-avisos.md) | Avisos en pantalla | 05, 08 | **done** |
| [TICKET-17](17-anonimizar-a-90-dias.md) | Anonimizar los datos de huéspedes a los 90 días | 04 | **done** |
| [TICKET-18](18-registro-tardio.md) | Registro tardío (contingencia) | 04 | **done** |
| [TICKET-19](19-desplegar-en-vps.md) | Desplegar el esqueleto en el VPS por la red privada | 01 | ready-for-agent |

**Frontera inicial:** TICKET-01. Después de él se pueden trabajar en paralelo 02, 03, 14 y 19.

## Segunda entrega (vitrina, lavandería y solicitudes de factura)

Especificada en docs/PRD.md v0.4 (RN-19 a RN-23, FR-24 a FR-29) con la tanda 4 de recepción (HG-ACT-001 §10). Aprobada por el usuario el 17-10-2026.

| Ticket | Título | Bloqueado por | Estado |
|---|---|---|---|
| [TICKET-20](20-catalogo-completo.md) | Catálogo completo en Ajustes | — | **done** |
| [TICKET-21](21-surtido-y-existencias.md) | Surtido y existencias | 20 | **done** |
| [TICKET-22](22-venta-de-contado.md) | Venta de contado | 21 | **done** |
| [TICKET-23](23-lavanderia-huespedes.md) | Lavandería para huéspedes | — | **done** |
| [TICKET-24](24-lavanderia-externos.md) | Lavandería para externos | 22, 23 | **done** |
| [TICKET-25](25-solicitudes-de-factura.md) | Solicitudes de factura | — | ready-for-agent |

**En espera:** archivo para el contador (FR-29), hasta hablar con él (T4-7).
**Frontera:** 20, 23 y 25 pueden empezar ya. Orden propuesto: 20 → 21 → 22 → 23 → 24 → 25.
