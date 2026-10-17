# 23: Lavandería para huéspedes

**ID:** TICKET-23
**Requisitos:** FR-27; RN-22, RN-07 (docs/PRD.md v0.4; fuente: HG-ACT-001 §10, tanda 4)

**What to build:** Recepción registra un pedido de lavandería (prendas y cantidades) para una habitación ocupada; el lavado se carga a su cuenta. Una lista muestra los pedidos por entregar. Al entregar la ropa se cobra; si no paga, solo se entrega con la autorización del recepcionista, que queda registrada, y la deuda sigue en la cuenta.

**Blocked by:** None (can start immediately)

**Status:** done

## Invariantes de negocio
- Precios del grupo Lavandería del catálogo (editables por la administración, RN-19).
- Estados del pedido: RECIBIDO → ENTREGADO. Entregar sin pago exige marcar «autorizo entregar sin pago» y deja quién autorizó.
- Nadie sale debiendo (RN-07): la salida sigue bloqueada mientras haya saldo.
- Lo que el hotel le cobre al recepcionista por una deuda es laboral: el sistema no lo calcula (SOW §5.3).
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] Un pedido de 2 busos y 1 pantalón para la 205 crea un cargo de $7.000 en su cuenta.
- [x] El pedido aparece en «Lavandería por entregar» hasta que se entrega.
- [x] Entregar cobrando registra el pago; entregar sin pago solo es posible con la autorización marcada y queda en la auditoría con el nombre del recepcionista.
- [x] Con la deuda pendiente, «Dar salida» sigue bloqueado.

## Módulos a tocar
nuevo módulo de lavandería, cargos, pagos, PWA (ficha y lista de pedidos).

## Verificación
`npm test -- --test-name-pattern="FR-27|lavander" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (17-10-2026)
- Migración 0004: `pedidos_lavanderia` (de una estadía o, desde el TICKET-24, de un externo con solo su nombre; estados RECIBIDO y ENTREGADO; quién entregó y quién autorizó sin pago), `pedidos_lavanderia_items` y `cargos.pedido_lavanderia_id`.
- API (recepción y administración):
  - `POST /estadias/{id}/lavanderia`: solo prendas activas de Lavandería (otra cosa responde 422 `NO_VENDIBLE`). Crea el pedido y un cargo «Lavandería: Prenda» por prenda en la cuenta.
  - `GET /lavanderia?estado=RECIBIDO`: lo que falta por entregar.
  - `POST /lavanderia/{id}/entrega`: lo que falta es el valor del pedido, sin pasar del saldo. Con `cobro` registra el pago (el efectivo entra a la caja; la transferencia queda por confirmar). Con `sin_pago_autorizado` entrega, deja quién autorizó y la deuda sigue en la cuenta. Sin ninguno de los dos responde 422 `PAGO_REQUERIDO`. Entregar dos veces responde 409.
  - `POST /estadias/{id}/cargos` ya no acepta prendas sueltas (409): la lavandería va como pedido, para seguir su entrega.
  - CONTRATO_API v0.4.3.
- La salida sigue bloqueada mientras haya saldo (RN-07): lo comprueba una prueba.
- PWA:
  - en la ficha, botón «Lavandería» que abre «Recibir lavandería» con solo las prendas; «Agregar cargos» ya no las muestra;
  - en la Caja, la tarjeta «Lavandería por entregar» con «Entregar», que abre un panel con lo que falta, el medio de pago y la casilla «yo autorizo entregar la ropa sin pago y asumo el riesgo»;
  - ícono nuevo de lavandería.
- TDD: 8 pruebas de API y 4 de la PWA en rojo antes del código.
- Verificación: 396 pruebas en verde; lint, tipos y compilación correctos.
- Navegador, con datos sintéticos: en la 205 se recibieron 2 busos y 1 pantalón ($7.000), que quedaron en la cuenta. En la Caja apareció el pedido por entregar. Al entregar cobrando en efectivo, la caja pasó de $234.500 a $241.500 y el pedido salió de la lista.
- Detalle menor: los cargos registrados en el mismo instante pueden salir en cualquier orden en la ficha (se ordenan por hora).
