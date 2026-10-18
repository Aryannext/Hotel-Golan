# 35: Informe de productos vendidos por turno, día, semana y mes

**ID:** TICKET-35
**Requisitos:** FR-32; RN-15, RN-21 (docs/PRD.md v0.6; fuente: HG-ACT-001 §11 V5-20)

**What to build:** En «Historial», la administración ve qué productos se vendieron, con cantidad y valor por producto. Puede verlo por turno, por día del hotel (de 6:30 a. m. a 6:30 a. m.) y por semana o por mes. Cuenta lo cargado a las habitaciones y lo vendido de contado. No hay que contar productos en el cambio de turno.

**Blocked by:** None (can start immediately).

**Status:** done

## Regla (18-10-2026)
«me gustaria saber que productos vende cada turno y que al finalizar el dia de 6:30am hasta el otro dia 6;30 am me salga o me muestre lo de ese dia, si quiero verlo semanal tambien o mensual tambien. sin contar cada cambio de turno eso es fastidioso.» (V5-20)

## Decisiones de diseño [P]
- **Qué cuenta:**
  - cargos de producto vigentes en las cuentas de las habitaciones;
  - ítems de ventas de contado cuyo pago no está anulado;
  - prendas de lavandería, en su propio grupo.
- **No cuenta:** alojamiento, extensiones, descuentos, llave, recargo de aseo ni daños. No son productos.
- **Turno de un cargo:** el turno en cuyo periodo se registró, porque los cargos no guardan su turno. Las ventas sí lo guardan.
- **Semana y mes:** un rango de días del hotel. Semana de lunes a domingo; mes calendario.
- **Agrupación:** por grupo (nevera, vitrinas y lavandería) y producto, con subtotales.
- **Al construir:** la lavandería de huéspedes ya se cuenta como cargo de producto. La de personas de afuera se suma desde sus pedidos, para no contarla dos veces. Lo de un turno abierto va hasta este momento.

## Invariantes de negocio
- Solo la administración (403 para recepción).
- Lo anulado no se cuenta. Los importes se toman del registro (precio del momento), no del catálogo actual (RN-19).
- Los totales de un día suman sus dos turnos.
- Reglas evaluadas en America/Bogota.

## Criterios de aceptación
- [x] En un turno con 2 «Agua» cargadas a una habitación y 1 «Agua» de contado, el informe del turno muestra Agua × 3 con su valor.
- [x] Un día del hotel suma su turno de día y su turno de noche.
- [x] Anular el pago de una venta de contado la quita del informe.
- [x] Cambiar el precio de un producto no altera lo ya vendido en el informe.
- [x] Rango semanal y mensual con los totales correctos.
- [x] Recepción recibe 403.

## Módulos a tocar
reportes (productos vendidos), PWA (Historial: selector turno, día, semana y mes), CONTRATO_API (aditivo).

## Verificación
`npm test -- --test-name-pattern="FR-32|productos vendidos" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
