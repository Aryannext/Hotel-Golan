# 15: Configuración: tarifas, reglas y catálogo

**ID:** TICKET-15
**Requisitos:** FR-22 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La administradora cambia tarifas, el valor por hora, el descuento, los pagos de turno y los productos con su precio. Los cambios aplican a lo nuevo, nunca a lo ya registrado.

**Blocked by:** TICKET-02 (Cotizar una estadía (precio y hora de salida)), TICKET-06 (Cargos y pagos en la cuenta de la habitación)

**Status:** done

## Invariantes de negocio
- Tarifas con vigencia: un cambio crea filas nuevas con `vigente_desde`; las cotizaciones usan la vigente en la hora de entrada.
- Los cargos ya hechos conservan su precio.
- Solo ADMINISTRACION.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] PUT /tarifas, GET y PATCH /reglas, POST y PUT /productos cumplen el contrato.
- [x] Una prueba demuestra que cambiar un precio no altera un cargo anterior.

## Módulos a tocar
configuracion, PWA (pantalla de configuración).

## Verificación
`npm test -- --test-name-pattern="FR-22|configuraci" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- API:
  - `GET /tarifas` devuelve la tarifa vigente de cada combinación (8). Recepción también puede consultarla.
  - `PUT /tarifas` crea filas nuevas con `vigente_desde` = ahora y no borra ni modifica las anteriores. Una cotización con entrada anterior al cambio usa el precio anterior.
  - Validaciones de `PUT /tarifas`: tres horas solo con personas = 2 (RN-03); no se aceptan combinaciones repetidas ni valores de 0.
  - `GET /reglas` y `PATCH /reglas` manejan las seis reglas. El PATCH cambia solo lo enviado y guarda quién lo hizo.
  - Validaciones de `PATCH /reglas`: hora de la noche completa entre 12 y 23; retención entre 1 y 3650 días.
  - `POST /productos` y `PUT /productos/{id}`: un nombre repetido en el grupo responde 409.
  - `GET /productos?incluir_inactivos=true` es solo para la administración.
  - Todo cambio queda en la auditoría, solo con lo que cambió.
- Lo nuevo y lo ya registrado:
  - una entrada anterior conserva su valor de alojamiento ($80.000) después de cambiar la tarifa;
  - el turno abierto conserva su pago al cambiar `pago_turno_noche`;
  - el cargo de Coca-Cola sigue en $4.000 después de subir el precio a $4.500; el cargo nuevo sale en $4.500.
- Decisiones de diseño [P], anotadas como cambio aditivo en CONTRATO_API v0.3.2:
  - el filtro `incluir_inactivos`;
  - la respuesta 409 en productos;
  - en la PWA solo se editan Nevera, Lavandería y «Llave, aseo y otros». La vitrina, con sus precios y la sección 1 de la familiar (RN-13), es de la segunda entrega.
- PWA: pestaña **Ajustes**, exclusiva de la administración, con tres secciones:
  - Tarifas, con la fecha desde la que rige cada una;
  - Reglas, con ayuda en palabras y la hora de la noche completa en un selector;
  - Productos: agregar, editar nombre y precio, quitar del catálogo y volver a poner.
- «Quién hizo qué», en Equipo, describe en frases los cambios de tarifas, reglas y productos. `textoActividad` pasó a una tabla de frases para mantener baja la complejidad que mide SonarCloud.
- TDD:
  - las 15 pruebas de API fallaron antes de crear las rutas;
  - las 7 de presentación (`src/web/ajustes.test.ts`) y los 8 casos nuevos de actividad fallaron antes de implementarse;
  - se corrigió un dato de la prueba, no el código: la habitación 211 de la semilla es de 3 personas ($80.000), no de 1.
- Verificación:
  - **291 pruebas en verde** (269 anteriores + 22 nuevas);
  - tipos limpios y compilación de producción correcta.
- Navegador, con PGlite y datos sintéticos:
  - cambiar Aire 1 persona a $65.000, el descuento a $6.000 y Coca-Cola a $4.500;
  - agregar «Jugo de caja» y quitar «Squash»;
  - la actividad lo describe en palabras;
  - en 360 px no hay desborde horizontal.
- Riesgo [R]: el tipo de cargo de «Llave perdida» y «Recargo aseo extremo» se deduce del nombre (`tipoDeCargo`, TICKET-06). Si se renombran sin conservar el inicio del nombre, sus cargos nuevos quedarían como «producto».
