# Casos de prueba — Sistema de recepción del Hotel Golán

Versión probada: `main` en `dbd24b3`. Se planificaron 52 casos. La tabla 1 lleva los ocho elementos de la Tabla 1 del CF35. La tabla 2 completa cada caso con el tipo de prueba, los datos de prueba, los pasos y la prueba automatizada que lo cubre.

**Precondición común de los casos CP-001 a CP-035:** una base nueva (PGlite) con el esquema real y la semilla sintética, cargada por `crearEntorno()` (`src/api/pruebas/entorno.ts`), con la hora del sistema fijada por la prueba. El turno de noche de `recepcion2` está abierto: recibió $208.500 y cobró $26.000 en efectivo. **Postcondición común:** la base en memoria se descarta al terminar el archivo de pruebas.

## Tabla 1 — Elementos del CF35

| Identificador | Nombre | Descripción | N.º de orden de ejecución | Requerimiento asociado | Precondición | Postcondición | Resultado esperado |
|---|---|---|---|---|---|---|---|
| CP-001 | Inicio de sesión correcto | Usuario y PIN válidos crean una sesión segura | 1 | FR-19, ADR-003 | Común | Sesión de 12 h abierta | 201 y cookie `sesion` HttpOnly, Secure, SameSite=Strict, Max-Age 12 h |
| CP-002 | PIN incorrecto (negativo) | El PIN incorrecto y el usuario inexistente no se distinguen | 2 | FR-19 | Común | Sin sesión | 401 `CREDENCIALES_INVALIDAS` en ambos casos |
| CP-003 | Bloqueo por intentos (negativo) | 5 fallos bloquean 15 min, aunque el PIN siguiente sea correcto | 3 | FR-19 | Común | Usuario bloqueado 15 min | 423 `USUARIO_BLOQUEADO` con el PIN correcto |
| CP-004 | Mapa de habitaciones | Se listan las 12 habitaciones con tipo y estado | 4 | FR-01 | Común | Sin cambios | 12 habitaciones en orden, de la 201 a la 211 y la 301 |
| CP-005 | Cotizar una noche | Precio y salida antes de confirmar | 5 | FR-04, RN-01, RN-02 | Común | Sin cambios (no guarda) | Aire, 3 personas, entra a las 3:00 p. m.: $95.000, sale mañana a las 12 m. |
| CP-006 | Cotizar tres horas con 3 personas (negativo) | Tres horas admite máximo 2 personas | 6 | FR-04, RN-03 | Común | Sin cambios | 422 `CAPACIDAD_EXCEDIDA` |
| CP-007 | Registrar entrada en efectivo | Crea la estadía, el cargo y el pago, y ocupa la habitación | 7 | FR-03, RN-02 | Común; 206 disponible | 206 OCUPADA con estadía ACTIVA | Cargo de $55.000, pago EN_CAJA y habitación OCUPADA |
| CP-008 | Entrada sin autorización de datos (negativo) | Sin la casilla del huésped no se guarda | 8 | FR-05, RN-16 | Común | Nada cambia | 422 `AUTORIZACION_REQUERIDA`; sin estadía nueva |
| CP-009 | Doble toque en la entrada | La misma Idempotency-Key no duplica | 9 | FR-03 | Común; 207 disponible | Una sola estadía y un solo pago | Misma estadía en las dos respuestas; 1 pago |
| CP-010 | Cargos con cantidad | Consumos y llave cargados a la cuenta | 10 | FR-06, RN-18 | Común; estadía activa en la 211 | Cargos guardados | Cada cargo guarda precio unitario y cantidad |
| CP-011 | Pago por transferencia | Un pago por Nequi queda por verificar | 11 | FR-07, RN-12 | Común | Pago POR_VERIFICAR | Baja el saldo, no entra a la caja y avisa a la administración |
| CP-012 | Confirmación en tiempo real | Recepción ve el «Llegó» de la administradora | 12 | FR-15, requisito no funcional (< 5 s) | Común; recepción suscrita a /eventos | Pago VERIFICADO | Evento `pago.verificado` recibido en menos de 5 s |
| CP-013 | Extender pasando las 4:00 p. m. | Las horas que pasan de las 4:00 p. m. se cobran como noche | 13 | FR-08, RN-04 | Aire, 1 persona; salida 12 m.; son las 11:50 a. m. | Estadía extendida | 5 horas → $60.000 (noche) y salida al día siguiente a las 12 m. |
| CP-014 | Salida con saldo (negativo) | Nadie sale debiendo | 14 | FR-09, RN-07 | Estadía con saldo pendiente | Estadía sigue ACTIVA | 409 `SALDO_PENDIENTE` |
| CP-015 | Salida con la cuenta al día | Se cierra la estadía y la habitación pasa a revisión | 15 | FR-09, FR-02 | Estadía con saldo $0 | Estadía CERRADA; habitación POR_REVISAR | CERRADA con hora real; POR_REVISAR |
| CP-016 | Desistimiento «solo miró» | Se devuelve lo pagado en efectivo | 16 | FR-10, RN-08 | Estadía pagada en efectivo | Estadía DESISTIDA | Devolución de $45.000 con movimiento DEVOLUCION |
| CP-017 | Caja del turno | Solo suma efectivo | 17 | FR-11, RN-10 | Común | Sin cambios | Debe haber $234.500; transferencias por $85.000 aparte |
| CP-018 | Salida de dinero | Baja la caja, no las ventas | 18 | FR-12, RN-10 | Común | Movimiento registrado | Debe haber pasa de $234.500 a $224.500; efectivo cobrado sigue en $26.000 |
| CP-019 | Entregar el turno que cuadra | Cierre con conteo | 19 | FR-13, RN-11 | Común | Turno CERRADO; turno de día por recibir | Esperado $184.500, diferencia 0 |
| CP-020 | Recibir el turno | Quien entra confirma la base | 20 | FR-14, RN-09 | Turno por recibir | Turno ABIERTO | ABIERTO con la base contada y el responsable |
| CP-021 | Resumen del día del hotel | Suma de 6:30 a. m. a 6:30 a. m. sin la base | 21 | FR-16, RN-15 | Turnos del 12-10 | Sin cambios | $195.000 + $26.000 = $221.000 |
| CP-022 | Anular un cobro | Se anula con motivo, sin borrar | 22 | FR-17, ADR-008 | Cobro en efectivo | Cobro marcado como anulado | Sigue visible, deja de sumar a la caja y la cuenta vuelve a deber |
| CP-023 | Recepción no anula (negativo) | Solo la administración anula | 23 | FR-17 | Sesión de recepción | Nada cambia | 403 `SIN_PERMISO` |
| CP-024 | Usuario desactivado | No entra y sus sesiones se cierran | 24 | FR-18 | `recepcion3` con 2 sesiones abiertas | Usuario inactivo | 401 al entrar y al usar las sesiones anteriores |
| CP-025 | Auditoría sin datos personales | La auditoría no revela huéspedes ni PIN | 25 | FR-20, ADR-006 | Entrada de un huésped sintético | Sin cambios | Ni el nombre, ni el documento, ni el teléfono, ni el PIN aparecen en GET /auditoria |
| CP-026 | Anonimizar a los 90 días | Borra nombre, documento y teléfono vencidos | 26 | FR-21, RN-16 | Salida el 10-07-2026; la tarea corre el 09-10-2026 | Huésped anonimizado | Datos nulos; cargos y pagos conservados; auditoría sin el dato |
| CP-027 | Cambio de precio | No altera los cargos anteriores | 27 | FR-22 | Coca-Cola a $4.000 cargada | Precio $4.500 | Cargo anterior $4.000; cargo nuevo $4.500 |
| CP-028 | Avisos de la semilla | La campana muestra lo pendiente | 28 | FR-23 | Común | Sin cambios | 211 por verificar, 207 por revisar y 204 en limpieza, sin nombres |
| CP-029 | Venta de contado | Productos vendidos sin habitación | 29 | FR-26 | Común | Venta registrada | $10.000 suman a la caja y descuentan existencias |
| CP-030 | Lavandería de huésped | Pedido cargado a la cuenta | 30 | FR-27 | Estadía en la 205 | Pedido por entregar | $7.000 cargados y por entregar |
| CP-031 | Solicitud de factura | Recepción la anota | 31 | FR-28, RN-23 | Estadía activa | Solicitud PENDIENTE | 201 con quién la registró y la fecha prevista (viernes → lunes) |
| CP-032 | Cambio de habitación | A los pocos minutos paga la diferencia | 32 | FR-30, RN-17 | Entrada en la 206 hace 3 min | Estadía en la 201 | Paga la diferencia de $15.000 |
| CP-033 | Quiénes se quedan hoy | Cada consulta queda auditada | 33 | FR-31 | Estadías activas | Registro CONSULTAR | Auditoría con quién consultó, sin nombres ni documentos |
| CP-034 | Recordatorio de Migración | Un extranjero deja un reporte pendiente | 34 | FR-33, RN-24 | Entradas de un extranjero y de un colombiano | Reporte pendiente | Pendiente solo para el extranjero |
| CP-035 | Registro tardío | La salida se calcula con la hora real | 35 | ADR-010, FR-03 | Son las 6:10 a. m.; entró a las 3:10 a. m. | Estadía marcada como tardía | Sale a las 12 m. del mismo día |
| CP-036 | Calidad estática | Código sin errores de lint, tipos ni compilación | 36 | Criterio de entrada E1 | Código de `main` | Sin cambios | ESLint sin avisos; `tsc` sin errores; compilación correcta |
| CP-037 | La PWA se sirve | El sistema en marcha entrega la aplicación | 37 | FR-01, requisito no funcional de disponibilidad | Entorno en :3001 | Sin cambios | 200 y HTML con el título del sistema |
| CP-038 | PIN incorrecto en el entorno (negativo) | El rechazo no deja cookie | 38 | FR-19 | Entorno en :3001 | Un intento fallido (se reinicia en CP-039) | 401 `CREDENCIALES_INVALIDAS` y sin cookie |
| CP-039 | Cookie segura en el entorno | Las banderas de la cookie en el sistema real | 39 | Requisito no funcional de seguridad, ADR-003 | Entorno en :3001 | Sesión abierta y luego cerrada | 201 con HttpOnly, Secure y SameSite=Strict |
| CP-040 | Acceso por rol en el entorno (negativo) | Sin sesión y con rol insuficiente | 40 | FR-18, requisito no funcional de privacidad | Sesión de recepción | Sin cambios | Sin sesión 401; /usuarios 403; habitaciones 200 (12) |
| CP-041 | Rendimiento de consulta | Latencia de las API de consulta | 41 | Requisito no funcional de rendimiento | Sesión de recepción | Sin cambios | p95 < 300 ms en GET /habitaciones, GET /turnos/actual y POST /cotizaciones |
| CP-042 | Caja a 360 px | Los botones caben y la página no se desplaza de lado | 42 | Requisito no funcional de usabilidad (360 px), FR-11, FR-12 | Sesión iniciada; ventana de 360 px | Sin cambios | Los botones dentro de la tarjeta; ancho del documento ≤ 360 px |
| CP-043 | La entrada conserva lo escrito | Cambiar de pestaña no borra el asistente | 43 | FR-03; requisito no funcional de usabilidad (derivado: no perder trabajo) | Asistente de entrada abierto, con datos | Datos intactos | Al volver, los datos siguen ahí, o el sistema pregunta antes de salir |
| CP-044 | Letra de los campos | Los campos no provocan zoom en el iPhone | 44 | Requisito no funcional de usabilidad (derivado: ≥ 16 px) | Asistente de entrada | Sin cambios | Letra de cada campo ≥ 16 px |
| CP-045 | Pestañas de la administración a 360 px | Todas las secciones se ven o se anuncian | 45 | Requisito no funcional de usabilidad (360 px); FR-16, FR-18, FR-22 | Sesión de `admin`; 360 px | Sin cambios | Las 6 pestañas visibles, o una señal clara de que hay más |
| CP-046 | Tamaño táctil | Los controles se pueden tocar con el dedo | 46 | Requisito no funcional de usabilidad (derivado: ≥ 44 px) | 360 px | Sin cambios | Ningún control por debajo de 44 × 44 px |
| CP-047 | Botón «Siguiente» a la vista | La acción principal del paso no queda escondida | 47 | Requisito no funcional de usabilidad (derivado) | Paso 1 de la entrada; 360 × 780 px | Sin cambios | «Siguiente» a menos de una pantalla de distancia |
| CP-048 | Contraste | Los textos se leen | 48 | Requisito no funcional de usabilidad; WCAG 2.2 AA | Inicio y Caja a 360 px | Sin cambios | Ningún texto por debajo de 4,5:1 (3:1 en texto grande) |
| CP-049 | Nombres y etiquetas | Botones con nombre y campos con etiqueta | 49 | Requisito no funcional de usabilidad; WCAG 2.2 A | Inicio, Caja y entrada | Sin cambios | 0 botones sin nombre; 0 campos sin etiqueta |
| CP-050 | Exploratoria: entrada y cuenta | Recorrido libre por los flujos más usados | 50 | FR-03, FR-06, FR-09 | Sesiones de recepción y de administración | Sin cambios | Sin comportamientos confusos ni mensajes faltantes |
| CP-051 | Práctica con recepción | 15 ejercicios de HG-GUIA-002 con el personal | 51 | SOW parte 12; FR-01 a FR-14 | Sistema en el VPS (TICKET-19) | Dudas registradas | El personal completa los ejercicios sin ayuda del desarrollador |
| CP-052 | Aceptación de la dueña | 7 ejercicios de administración y aprobación | 52 | HG-SOW-001; FR-15 a FR-22 | CP-051 hecho | Acta de aceptación | La dueña aprueba el uso con huéspedes reales |

## Tabla 2 — Tipo, datos, pasos y prueba que lo cubre

| Caso | Tipo y cuadrante | Datos de prueba | Pasos | Prueba automatizada que lo cubre |
|---|---|---|---|---|
| CP-001 | Funcional · Q2 | `recepcion1` + PIN de la semilla | 1. POST /sesiones. 2. Leer la cookie. | `identidad.test.ts` — «PIN correcto: 201 y cookie HttpOnly, Secure, SameSite=Strict de 12 horas» |
| CP-002 | Funcional negativa · Q2 | PIN 000000; usuario inexistente | 1. POST /sesiones con un PIN malo. 2. POST con un usuario inexistente. 3. Comparar. | `identidad.test.ts` — «PIN incorrecto y usuario inexistente responden igual…» |
| CP-003 | Seguridad · Q4 | 5 PIN malos y luego el correcto | 1. Cinco POST fallidos. 2. POST con el PIN correcto. | `identidad.test.ts` — «bloqueo tras 5 intentos fallidos…» |
| CP-004 | Funcional · Q2 | Semilla | GET /habitaciones | `habitaciones.test.ts` — «devuelve las 12 habitaciones en orden, con tipo y estado» |
| CP-005 | Funcional · Q2 | 201, NOCHE, 3 personas, 15:00 | POST /cotizaciones | `cotizaciones.test.ts` — «noche con aire, 3 personas…: $95.000…» |
| CP-006 | Funcional negativa · Q2 | TRES_HORAS, 3 personas | POST /cotizaciones | `cotizaciones.test.ts` — «3 personas en tres horas: 422 CAPACIDAD_EXCEDIDA» |
| CP-007 | Funcional · Q2 | 206, 2 personas, «Huésped Prueba 30», PRUEBA12345678, efectivo $60.000 | POST /estadias | `estadias.test.ts` — «entrada pagada en efectivo…» |
| CP-008 | Funcional negativa · Q2 | `autorizacion.otorgada = false` | POST /estadias | `estadias.test.ts` — «sin autorización de datos no se registra…» |
| CP-009 | Funcional · Q2 | Clave `7f3c2a1e-…` dos veces | Dos POST /estadias con la misma clave | `estadias.test.ts` — «reenviar con la misma Idempotency-Key…» |
| CP-010 | Funcional · Q2 | Productos de la semilla con cantidad + llave | POST /estadias/{id}/cargos | `cuenta.test.ts` — «varios productos con cantidad y la llave perdida…» |
| CP-011 | Funcional · Q2 | Nequi | POST /estadias/{id}/pagos | `cuenta.test.ts` — «un pago por Nequi queda POR_VERIFICAR…» |
| CP-012 | Funcional y tiempo real · Q2/Q4 | Pago por verificar de la semilla | 1. Recepción se suscribe a /eventos. 2. La administración confirma. 3. Medir el tiempo. | `eventos.test.ts` — «la recepción suscrita recibe pago.verificado en menos de 5 s…» |
| CP-013 | Funcional · Q2 | 5 horas a las 11:50 a. m. | POST /estadias/{id}/extensiones | `extension.test.ts` — «5 hora(s) → cargo EXTENSION de $60000…» |
| CP-014 | Funcional negativa · Q2 | Estadía con saldo | POST /estadias/{id}/salida | `salida.test.ts` — «salida bloqueada por saldo: 409…» |
| CP-015 | Funcional · Q2 | Estadía con saldo $0 | POST /estadias/{id}/salida | `salida.test.ts` — «salida con la cuenta al día…» |
| CP-016 | Funcional · Q2 | SOLO_MIRO, efectivo | POST /estadias/{id}/devoluciones | `devolucion.test.ts` — «solo miró la habitación y pagó en efectivo…» |
| CP-017 | Funcional · Q2 | Turno de la semilla | GET /turnos/actual | `turnos.test.ts` — «caja del ejemplo real del relevo…» |
| CP-018 | Funcional · Q2 | COMPRA_HOTEL por $10.000 | POST /movimientos_caja | `movimientos.test.ts` — «compra para el hotel de $10.000…» |
| CP-019 | Funcional · Q2 | Contado $184.500; pago tomado | POST /turnos/actual/entrega | `entrega.test.ts` — «entrega que cuadra…» |
| CP-020 | Funcional · Q2 | Base recibida con un toque | POST /turnos/actual/recepcion | `turnos.test.ts` — «recibir el turno con un toque…» |
| CP-021 | Funcional · Q2 | Rango 12-10 a 12-10 | GET /reportes/dias | `reportes.test.ts` — «Resumen del día 12 de octubre…» |
| CP-022 | Funcional · Q2 | Pago en efectivo de $4.000 de la semilla; motivo «Cobro registrado dos veces» | POST /pagos/{id}/anulacion | `anulaciones.test.ts` — «anular un cobro en efectivo…» |
| CP-023 | Seguridad · Q4 | Sesión de `recepcion2` | POST /pagos/{id}/anulacion | `anulaciones.test.ts` — «recepción no anula: 403 SIN_PERMISO» |
| CP-024 | Seguridad · Q4 | `recepcion3` | 1. Abrir 2 sesiones. 2. PATCH activo=false. 3. Usar las sesiones y entrar otra vez. | `usuarios.test.ts` — «Escenario «Usuario desactivado»…» |
| CP-025 | Seguridad y privacidad · Q4 | «Huésped Prueba 77», PRUEBA7777 | 1. Registrar la entrada. 2. GET /auditoria. 3. Buscar los datos. | `usuarios.test.ts` — «no expone datos de huéspedes ni PIN» |
| CP-026 | Funcional y privacidad · Q2 | «Ana Prueba Sintética» (sintética) | Correr `anonimizarVencidos` el 09-10-2026 | `anonimizacion.test.ts` — «Escenario «Anonimizar a los 90 días»…» |
| CP-027 | Funcional · Q2 | Coca-Cola de $4.000 a $4.500 | 1. PUT /productos/{id}. 2. Comparar el cargo viejo y el nuevo. | `configuracion.test.ts` — «cambiar un precio no altera un cargo anterior…» |
| CP-028 | Funcional · Q2 | Semilla | `calcularAvisos` con GET /habitaciones y GET /reglas | `avisos.test.ts` — «211 con transferencia por verificar…» |
| CP-029 | Funcional · Q2 | 2 aguas + 1 Gatorade | POST /ventas | `ventas.test.ts` — «2 aguas y 1 Gatorade en efectivo…» |
| CP-030 | Funcional · Q2 | 2 busos + 1 pantalón | POST /estadias/{id}/lavanderia | `lavanderia.test.ts` — «2 busos y 1 pantalón para la 205…» |
| CP-031 | Funcional · Q2 | RUT sintético + correo | POST /estadias/{id}/solicitudes-factura | `facturas.test.ts` — «201: queda PENDIENTE…» |
| CP-032 | Funcional · Q2 | 206 → 201 a los 3 min | POST /estadias/{id}/cambio-habitacion | `cambio-habitacion.test.ts` — «de ventilador (206) a aire (201)…» |
| CP-033 | Seguridad y privacidad · Q4 | Estadías activas | GET /huespedes/hoy y luego auditoría | `huespedes-hoy.test.ts` — «cada consulta queda en la auditoría…» |
| CP-034 | Funcional · Q2 | Nacionalidad «Venezuela» (206) y «colombiana» (208), con pasaporte PRUEBA… | POST /estadias ×2 y GET /migracion/pendientes | `migracion.test.ts` — «la entrada de un extranjero deja pendiente…» |
| CP-035 | Funcional · Q2 | `entrada_en` 03:10 | POST /estadias con `registro_tardio` | `registro-tardio.test.ts` — «una entrada de hace 3 horas…» |
| CP-036 | Calidad estática · Q1 | Código de `main` | `npm run lint`, `npm run tipos`, `npm run web:build` | Comandos de npm |
| CP-037 | Humo · Q2 | — | GET / | `pruebas/humo-entorno.ts` |
| CP-038 | Seguridad · Q4 | `recepcion1`, PIN 000000 | POST /sesiones | `pruebas/humo-entorno.ts` |
| CP-039 | Seguridad · Q4 | `recepcion1` + PIN de la semilla | POST /sesiones y leer Set-Cookie | `pruebas/humo-entorno.ts` |
| CP-040 | Seguridad · Q4 | Sin cookie; cookie de recepción | GET /habitaciones, GET /usuarios | `pruebas/humo-entorno.ts` |
| CP-041 | Rendimiento · Q4 | 200 solicitudes secuenciales por API | Medir p50, p95 y máximo | `pruebas/humo-entorno.ts` |
| CP-042 | Usabilidad · Q3 | Ventana de 360 × 780; turno de la semilla | 1. Abrir Caja. 2. Medir los botones y el ancho del documento. | Manual asistida (script de medición) |
| CP-043 | Usabilidad · Q3 | «Huésped Prueba CF35» | 1. Abrir la 201. 2. Escribir el nombre. 3. Tocar «Caja». 4. Volver y abrir la 201. | Manual |
| CP-044 | Usabilidad · Q3 | — | Medir `font-size` de los campos del paso 1 | Manual asistida |
| CP-045 | Usabilidad · Q3 | Sesión de `admin`, 360 px | Medir la posición de cada pestaña | Manual asistida |
| CP-046 | Usabilidad · Q3 | 360 px | Medir los controles del inicio, la Caja y la cuenta de la 205 | Manual asistida |
| CP-047 | Usabilidad · Q3 | 360 × 780 | Medir la posición de «Siguiente» en el paso 1 | Manual asistida |
| CP-048 | Accesibilidad · Q3 | 360 px | Calcular el contraste de cada texto visible | Manual asistida |
| CP-049 | Accesibilidad · Q3 | 360 px | Contar botones sin nombre y campos sin etiqueta | Manual asistida |
| CP-050 | Exploratoria · Q3 | Sesiones de recepción y de administración | Recorrido libre de 20 min por la entrada y la cuenta | Manual |
| CP-051 | Aceptación · Q3 | Guía HG-GUIA-002 | 15 ejercicios con el personal | Manual (personas) |
| CP-052 | Aceptación · Q3 | Guía HG-GUIA-002 | 7 ejercicios con la dueña y su aprobación | Manual (personas) |
