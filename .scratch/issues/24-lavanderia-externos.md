# 24: Lavandería para externos

**ID:** TICKET-24
**Requisitos:** FR-27; RN-22, RN-20 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** Recepción registra un pedido de lavandería para una persona que no está hospedada, anotando solo su nombre. Puede pagar por adelantado o al reclamar. Sin pago no se entrega, salvo con la autorización registrada del recepcionista; la deuda queda a nombre de esa persona y con quien la autorizó.

**Blocked by:** TICKET-22 (Venta de contado), TICKET-23 (Lavandería para huéspedes)

**Status:** done

## Invariantes de negocio
- Solo el nombre de la persona externa (T4-4): sin documento ni teléfono. Ese nombre se anonimiza con la misma política de los huéspedes (90 días, RN-16) [P/V].
- Los pagos usan los pagos sin habitación del TICKET-22: el efectivo va a la caja del turno y la transferencia queda «por verificar».
- Las deudas de externos se ven en una lista para la administración.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] Un pedido externo pagado por adelantado en efectivo suma a la caja y queda por entregar.
- [x] Un pedido externo sin pagar no se entrega sin la autorización; con ella queda como deuda con el nombre y el recepcionista.
- [x] La administración ve las deudas de lavandería de externos.
- [x] El nombre del externo se borra con la tarea de anonimización.

## Módulos a tocar
lavandería, cobros, privacidad (anonimización), PWA.

## Verificación
`npm test -- --test-name-pattern="FR-27|externo" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (17-10-2026)
- Migración 0005: `pagos.pedido_lavanderia_id` y la regla de un solo dueño por pago (`num_nonnulls(estadia_id, venta_id, pedido_lavanderia_id) = 1`); `pedidos_lavanderia.anonimizado_en`.
- API (recepción y administración):
  - `POST /lavanderia`: solo el nombre (2 a 120 caracteres) y las prendas; con `cobro` paga de una vez.
  - `POST /lavanderia/{id}/cobro`: cobra todo lo que falta; 409 si ya está pagado o si es de un huésped.
  - `GET /lavanderia/deudas`: externos entregados con saldo.
  - `POST /lavanderia/{id}/entrega` sirve también para externos: lo que falta es el total menos sus pagos vigentes; una transferencia por verificar cuenta como pagada.
  - `PedidoLavanderia.por_cobrar` y `Pago.pedido_lavanderia_id` / `lavanderia_cliente` (CONTRATO_API v0.4.4).
- El módulo de lavandería se reorganizó para que huéspedes y externos compartan la creación del pedido, el cobro y la entrega.
- Anonimización: el nombre del externo pasa a «Externo anonimizado» cuando la entrega tiene más de `retencion_datos_dias` (90 [P/V]), con su propia auditoría y sin el dato borrado. La deuda conserva el valor y quién autorizó.
- PWA:
  - en la Caja, el botón «Lavandería de afuera» abre un panel con nombre, prendas y «¿Cuándo paga?» (al reclamar o ya, por efectivo, Nequi o Bancolombia);
  - la entrega de externos usa lo que debe el pedido;
  - la tarjeta «Deudas de lavandería» tiene «Cobrar»;
  - «Lo de este turno» y «Por confirmar» muestran «Lavandería · Nombre».
- Se actualizó la prueba de contrato de `GET /pagos` con los dos campos nuevos (aditivo).
- TDD: 6 pruebas de API y 2 de la PWA en rojo antes del código.
- Verificación: 404 pruebas en verde; lint, tipos y compilación correctos.
- Navegador, con datos sintéticos: se recibió una cobija de «Cliente Externo Prueba» a pagar al reclamar. Se entregó sin pago con autorización y apareció en «Deudas de lavandería» («Autorizó recepcion2 · $5.000»). Al cobrarla en efectivo, la caja pasó de $234.500 a $239.500 y la deuda desapareció.
