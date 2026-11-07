| Caso | Suite | Prueba | Resultado |
|---|---|---|---|
| CP-001 | FR-19 — Inicio de sesión | PIN correcto: 201 y cookie HttpOnly, Secure, SameSite=Strict de 12 horas | Exitoso |
| CP-002 | FR-19 — Inicio de sesión | PIN incorrecto y usuario inexistente responden igual: 401 CREDENCIALES_INVALIDAS | Exitoso |
| CP-003 | FR-19 — Inicio de sesión | bloqueo tras 5 intentos fallidos durante 15 minutos, aunque el PIN sea correcto | Exitoso |
| CP-004 | FR-01 — Mapa de habitaciones | devuelve las 12 habitaciones en orden, con tipo y estado | Exitoso |
| CP-005 | FR-04 — Cotizar una estadía | noche con aire, 3 personas, entrando a las 3:00 p. m.: $95.000 y sale mañana a las 12 m. | Exitoso |
| CP-006 | FR-04 — Cotizar una estadía | 3 personas en tres horas: 422 CAPACIDAD_EXCEDIDA | Exitoso |
| CP-007 | RN-06, RN-16, FR-05 — Registro de la entrada | entrada pagada en efectivo: estadía ACTIVA, cargo de 55.000, pago EN_CAJA y habitación OCUPADA | Exitoso |
| CP-008 | RN-06, RN-16, FR-05 — Registro de la entrada | sin autorización de datos no se registra: 422 AUTORIZACION_REQUERIDA y nada cambia | Exitoso |
| CP-009 | FR-03 — Idempotencia: un doble toque no duplica el registro | reenviar con la misma Idempotency-Key devuelve la misma estadía y existe un solo pago | Exitoso |
| CP-010 | FR-06, RN-18, RN-14 — Cargos a la cuenta | varios productos con cantidad y la llave perdida: cada cargo guarda precio unitario y cantidad | Exitoso |
| CP-011 | FR-07, RN-06 — Pagos y abonos a la cuenta | un pago por Nequi queda POR_VERIFICAR: baja el saldo, no entra a la caja y avisa a la administración | Exitoso |
| CP-012 | RN-12, FR-15, SSE — Eventos en tiempo real | la recepción suscrita recibe pago.verificado en menos de 5 s cuando la administradora confirma | Exitoso |
| CP-013 | RN-04, FR-08 — Extender después del mediodía (aire, 1 persona, salida 12 m., son las 11:50 a. m.) | 5 hora(s) → cargo EXTENSION de $60000 y nueva salida 2026-10-13T12:00:00-05:00 | Exitoso |
| CP-014 | RN-07, FR-09 — Nadie sale debiendo | salida bloqueada por saldo: 409 SALDO_PENDIENTE y la estadía sigue ACTIVA | Exitoso |
| CP-015 | RN-07, FR-09 — Nadie sale debiendo | salida con la cuenta al día: CERRADA con hora real y la habitación queda POR_REVISAR | Exitoso |
| CP-016 | RN-08, FR-10 — Devolución por desistimiento | solo miró la habitación y pagó en efectivo: se devuelven 45.000 con un movimiento DEVOLUCION en el turno abierto | Exitoso |
| CP-017 | RN-10, FR-11 — La caja del turno solo suma efectivo | caja del ejemplo real del relevo: 208.500 + 26.000 = 234.500; transferencias 85.000 aparte | Exitoso |
| CP-018 | FR-12, RN-10 — Una salida de dinero baja la caja, pero no cuenta como venta | compra para el hotel de $10.000: «debe haber» pasa de 234.500 a 224.500 y el efectivo cobrado sigue en 26.000 | Exitoso |
| CP-019 | RN-09, RN-11, FR-13 — Entrega del turno | entrega que cuadra: CERRADO con esperado 184.500 y diferencia 0; el turno de día queda por recibir con 184.500 | Exitoso |
| CP-020 | RN-09, RN-11, FR-14 — Recibir el turno | recibir el turno con un toque: queda ABIERTO con la base contada y el usuario como responsable | Exitoso |
| CP-021 | FR-16 / RN-15 — historial y reporte del día del hotel | Resumen del día 12 de octubre: 195.000 + 26.000 = 221.000, sin sumar la base | Exitoso |
| CP-022 | FR-17, FR-20 — Anulaciones de la administración | anular un cobro en efectivo: sigue visible como anulado, deja de sumar a la caja y la cuenta vuelve a deber | Exitoso |
| CP-023 | FR-17, FR-20 — Anulaciones de la administración | recepción no anula: 403 SIN_PERMISO | Exitoso |
| CP-024 | FR-18 — Usuarios (solo la administración) | Escenario «Usuario desactivado»: no puede entrar y sus sesiones anteriores quedan revocadas | Exitoso |
| CP-025 | FR-20 — Auditoría | no expone datos de huéspedes ni PIN | Exitoso |
| CP-026 | FR-21 — anonimizar a los 90 días | Escenario «Anonimizar a los 90 días»: salida el 10-07-2026, tarea el 09-10-2026 | Exitoso |
| CP-027 | FR-22 — Catálogo de productos | cambiar un precio no altera un cargo anterior; los cargos nuevos usan el precio nuevo | Exitoso |
| CP-028 | FR-23 — avisos de la semilla | 211 con transferencia por verificar, 207 por revisar y 204 en limpieza; sin nombres de huéspedes | Exitoso |
| CP-029 | FR-26 — Venta de contado en efectivo | 2 aguas y 1 Gatorade en efectivo: 201, $10.000, suma a la caja y descuenta existencias | Exitoso |
| CP-030 | FR-27 — Pedido de lavandería de un huésped | 2 busos y 1 pantalón para la 205: 201, $7.000, cargado a la cuenta y por entregar | Exitoso |
| CP-031 | FR-28 — recepción anota la solicitud desde la estadía | 201: queda PENDIENTE, con quién la registró y la fecha prevista (viernes → lunes) | Exitoso |
| CP-032 | RN-17 (V5-03, V5-05) — cambia de opinión a los pocos minutos de entrar | de ventilador (206) a aire (201) a los 3 minutos: paga la diferencia de $15.000 | Exitoso |
| CP-033 | FR-31 (V5-02) — quiénes se quedan hoy | cada consulta queda en la auditoría con quién la hizo, sin nombres ni documentos | Exitoso |
| CP-034 | FR-33 (RN-24) — reportes a Migración Colombia | la entrada de un extranjero deja pendiente su llegada; la de un colombiano no | Exitoso |
| CP-035 | ADR-010 — Registro tardío | una entrada de hace 3 horas calcula la salida con la hora real (3:10 a. m. → 12 m. del mismo día) | Exitoso |
