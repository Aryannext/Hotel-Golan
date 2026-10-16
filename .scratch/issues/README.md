# Tickets — primera entrega (caja, transferencias y habitaciones)

Fase 2 del pipeline AI-SDLC (16-10-2026). Aprobados por el usuario. Se trabaja la **frontera**: cualquier ticket cuyos bloqueos ya estén terminados.

| Ticket | Título | Bloqueado por | Estado |
|---|---|---|---|
| [TICKET-01](01-iniciar-sesion-y-mapa.md) | Iniciar sesión y ver el mapa de habitaciones | — | ready-for-agent |
| [TICKET-02](02-cotizar-estadia.md) | Cotizar una estadía (precio y hora de salida) | 01 | ready-for-agent |
| [TICKET-03](03-recibir-turno-y-ver-caja.md) | Recibir el turno y ver la caja | 01 | ready-for-agent |
| [TICKET-04](04-entrada-en-efectivo.md) | Registrar una entrada pagada en efectivo | 02, 03 | ready-for-agent |
| [TICKET-05](05-transferencia-y-confirmacion-en-vivo.md) | Transferencia por verificar y confirmación en tiempo real | 04 | ready-for-agent |
| [TICKET-06](06-cargos-y-pagos-en-la-cuenta.md) | Cargos y pagos en la cuenta de la habitación | 04 | ready-for-agent |
| [TICKET-07](07-extender-estadia.md) | Extender la estadía con la regla de las 4 p. m. | 02, 06 | ready-for-agent |
| [TICKET-08](08-salida-y-revision.md) | Dar salida y revisar la habitación | 06 | ready-for-agent |
| [TICKET-09](09-desistimiento-y-devolucion.md) | Desistimiento y devolución | 05 | ready-for-agent |
| [TICKET-10](10-salidas-de-dinero.md) | Salidas de dinero de la caja | 03 | ready-for-agent |
| [TICKET-11](11-entregar-turno.md) | Entregar el turno con conteo | 10 | ready-for-agent |
| [TICKET-12](12-anulaciones.md) | Anulaciones (administración) | 06, 10 | ready-for-agent |
| [TICKET-13](13-historial-y-dia-del-hotel.md) | Historial de turnos y resumen por día del hotel | 11 | ready-for-agent |
| [TICKET-14](14-usuarios-pin-y-auditoria.md) | Usuarios, PIN y auditoría (administración) | 01 | ready-for-agent |
| [TICKET-15](15-configuracion-tarifas-y-catalogo.md) | Configuración: tarifas, reglas y catálogo | 02, 06 | ready-for-agent |
| [TICKET-16](16-avisos.md) | Avisos en pantalla | 05, 08 | ready-for-agent |
| [TICKET-17](17-anonimizar-a-90-dias.md) | Anonimizar los datos de huéspedes a los 90 días | 04 | ready-for-agent |
| [TICKET-18](18-registro-tardio.md) | Registro tardío (contingencia) | 04 | ready-for-agent |
| [TICKET-19](19-desplegar-en-vps.md) | Desplegar el esqueleto en el VPS por la red privada | 01 | ready-for-agent |

**Frontera inicial:** TICKET-01. Después de él se pueden trabajar en paralelo 02, 03, 14 y 19.
