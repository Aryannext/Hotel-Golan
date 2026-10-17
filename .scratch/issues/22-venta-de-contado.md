# 22: Venta de contado

**ID:** TICKET-22
**Requisitos:** FR-26; RN-20, RN-21, RN-10, RN-12 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** Recepción vende productos sin habitación (a quien mira las habitaciones y no se queda, por ejemplo), con cantidades y medio de pago. El efectivo suma a «En la caja debe haber»; una transferencia queda «por confirmar» para la administración; las existencias bajan; la venta aparece en «Lo de este turno» y en el historial, y la administración puede anularla.

**Blocked by:** TICKET-21 (Surtido y existencias)

**Status:** done

## Invariantes de negocio
- Prefactor: hoy cada pago pertenece a una estadía. Los pagos de contado no tienen habitación: el esquema y las consultas de caja, verificación e historial deben aceptarlo sin cambiar lo que ya cuadra.
- Medios: efectivo, Nequi o Bancolombia (T4-14). Transferencia → «por verificar» (RN-12).
- El efectivo de contado es un cobro más del turno (RN-10) y no se mezcla con la sección 1 (fuera del sistema).
- Idempotencia: un doble toque no duplica la venta.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] Una venta en efectivo de $6.000 sube «En la caja debe haber» en $6.000 y aparece en «Lo de este turno».
- [x] Una venta por Nequi aparece en «Por confirmar» y no suma a la caja hasta que se confirme.
- [x] Las existencias de los productos vendidos bajan.
- [x] La administración puede anularla con motivo; la caja y las existencias se recalculan.
- [x] El historial del turno y el resumen por día incluyen las ventas de contado.

## Módulos a tocar
caja, cobros (pagos y anulaciones), reportes, inventario, tiempo real, PWA (Caja).

## Verificación
`npm test -- --test-name-pattern="FR-26|contado" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (17-10-2026)
- Migración 0003: `ventas` y `ventas_items` (con orden de venta). `pagos.estadia_id` admite NULL y se agregó `venta_id`, con la regla de que cada pago es de una estadía o de una venta, nunca de las dos. Un pago por venta.
- `POST /ventas` (recepción y administración, con Idempotency-Key):
  - solo productos activos de nevera y vitrinas; lavandería o llave responden 422 `NO_VENDIBLE`; inactivo 409; inexistente 404;
  - exige turno abierto; el precio lo pone el servidor;
  - EFECTIVO → EN_CAJA y evento `caja.movimiento`; NEQUI/BANCOLOMBIA → POR_VERIFICAR y evento `pago.por_verificar` sin habitación;
  - auditoría de la venta y de su pago.
- Sin cambios en la caja ni en el resumen por día: ya sumaban los pagos por turno. Se ajustaron las consultas que exigían una estadía (lista de pagos con `venta_id` y `venta_detalle`, anulación, verificación) y las existencias (lo vendido incluye las ventas cuyo pago no está anulado).
- Anular una venta = anular su pago (`POST /pagos/{id}/anulacion`): la caja y las existencias se recalculan.
- PWA: botón «Venta de contado» en la Caja, con un panel que reutiliza el selector de productos de la ficha (ahora `SelectorProductos`). En efectivo calcula las vueltas y no deja registrar si falta plata (de contado no hay abonos). «Lo de este turno», el Historial y «Por confirmar» muestran «Venta de contado · Agua × 2, …». Los avisos en vivo dicen «de una venta de contado».
- Se actualizó la prueba de contrato de `GET /pagos` con los dos campos nuevos (cambio aditivo, CONTRATO_API v0.4.2).
- TDD: 8 pruebas de API y 6 de la PWA en rojo antes del código.
- Verificación: 384 pruebas en verde; lint, tipos y compilación correctos.
- Navegador, con datos sintéticos: 2 aguas y 1 Gatorade ($10.000). Con $5.000 recibidos lo bloqueó («Falta $5.000»); con $20.000 mostró $10.000 de vueltas. Al registrar, la caja pasó de $234.500 a $244.500 y la línea apareció en «Lo de este turno». Una venta por Nequi apareció en «Por confirmar» de la administración como «Venta de contado · Pony Malta × 2».
