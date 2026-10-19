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
| [TICKET-19](19-desplegar-en-vps.md) | Desplegar el sistema en el VPS por la red privada (actualizado el 17-10-2026, HG-AUD-001 H-05) | 01; revisión del VPS | ready-for-agent |

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
| [TICKET-25](25-solicitudes-de-factura.md) | Solicitudes de factura | — | **done** |

**En espera:** archivo para el contador (FR-29), hasta hablar con él (T4-7).
**Frontera:** 20, 23 y 25 pueden empezar ya. Orden propuesto: 20 → 21 → 22 → 23 → 24 → 25.

## Hallazgos de la auditoría de trazabilidad (17-10-2026)

Salen de HG-AUD-001 v0.1. Aprobados por el usuario el 17-10-2026. Los marcados `needs-info` esperan una decisión de la administradora (guía HG-VAL-001).

| Ticket | Título | Bloqueado por | Estado |
|---|---|---|---|
| [TICKET-26](26-cambio-de-habitacion.md) | Cambio de habitación (y aviso de ropa en lavandería al dar salida) | — | **done** |
| [TICKET-27](27-cobrar-un-dano.md) | Cobrar un daño (solo la administración) | — | **done** |
| [TICKET-28](28-aviso-de-privacidad.md) | Aviso de privacidad visible en la entrada | — (para usarlo con huéspedes reales: asesor y 36 a 38) | **done** (pantalla; falta la revisión del asesor para usarlo con datos reales) |
| [TICKET-29](29-guia-y-practica.md) | Guía corta de uso y sesión de práctica | 19 (para la práctica) | in-progress (guía escrita; práctica después del 19) |

**Orden propuesto:** 19 (cuando el usuario avise) · 26, 27 y 28 apenas responda la administradora · 29 al final.

## Validaciones de la administradora (18-10-2026)

Salen de HG-ACT-001 §11 (V5-01 a V5-21) y de PRD v0.6. Aprobados por el usuario el 18-10-2026.

| Ticket | Título | Bloqueado por | Estado |
|---|---|---|---|
| [TICKET-30](30-franja-de-salida-10am.md) | Nueva franja de salida: desde las 10:00 a. m., a las 12 m. del día siguiente | — | **done** |
| [TICKET-31](31-registro-tardio-al-turno-de-entrada.md) | Registro tardío: la plata va al turno en que entró el huésped | — | **done** |
| [TICKET-32](32-productos-de-la-familiar.md) | Productos de la familiar: la regla es por dueño, no por sección | — | **done** |
| [TICKET-33](33-factura-de-1-a-3-dias-habiles.md) | Factura prevista entre 1 y 3 días hábiles | 25 (hecho) | **done** |
| [TICKET-34](34-lista-para-la-policia.md) | Quiénes se quedan hoy (lista para la policía) | — | **done** |
| [TICKET-35](35-informe-de-productos-vendidos.md) | Informe de productos vendidos por turno, día, semana y mes | — | **done** |

**Orden propuesto:**
- primero los pequeños que corrigen reglas: 30 → 32 → 33;
- luego 31, 26 y 27;
- después 34 y 35;
- el 28 cuando haya texto aprobado;
- el 19 cuando el usuario avise;
- el 29 al final.

## Obligaciones legales del registro de huéspedes (18-10-2026)

Salen de la investigación HG-PRIV-002 y de la conversación con la dueña (HG-ACT-001 §12, V6-01 a V6-12). Regla del usuario: **la ley prevalece sobre lo que pida el hotel**. Aprobados por el usuario el 18-10-2026.

| Ticket | Título | Bloqueado por | Estado |
|---|---|---|---|
| [TICKET-36](36-documento-obligatorio.md) | El documento del titular es obligatorio (registro de huéspedes) | — | **done** |
| [TICKET-37](37-recordatorio-migracion.md) | Recordatorio para reportar a los extranjeros a Migración Colombia | — | **done** |
| [TICKET-38](38-conservacion-segun-la-ley.md) | Guardar los datos de los huéspedes el tiempo que exija la ley | plazo legal (contador o asesor) | needs-info |

**Orden propuesto:** 36 → 37 → 28 → 38 (cuando se sepa el plazo) → 19 (cuando el usuario avise) → 29 al final.
