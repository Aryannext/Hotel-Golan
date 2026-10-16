# 02: Cotizar una estadía (precio y hora de salida)

**ID:** TICKET-02
**Requisitos:** FR-04; RN-01, RN-02, RN-03, RN-05 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Al elegir habitación, modalidad, personas y noches, la recepcionista ve el precio, el descuento si el cliente lo pide y la hora de salida, antes de registrar nada. Incluye el módulo `reglas`, puro y sin base de datos (ADR-001).

**Blocked by:** TICKET-01 (Iniciar sesión y ver el mapa de habitaciones)

**Status:** ready-for-agent

## Invariantes de negocio
- Salida: hasta las 6:00 a. m. → 12 m. del mismo día; de 6:01 a 11:59 a. m. → 24 horas; desde las 12 m. → 12 m. del día siguiente; N noches según RN-01.
- Noche: 1, 2 o 3 personas según la tarifa (la tercera paga $25.000); 4 personas → 400. Tres horas: precio único para 1 o 2 personas; 3 personas → 422 CAPACIDAD_EXCEDIDA.
- Descuento: $5.000 × noches, solo en NOCHE; en TRES_HORAS → 422 DESCUENTO_NO_PERMITIDO.
- `permite_pago_al_salir` es verdadero solo con NOCHE y 1 noche.
- Las horas se calculan en America/Bogota, no en la hora del servidor.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] POST /cotizaciones cumple el contrato.
- [ ] Pasan los ejemplos de las reglas RN-01, RN-02, RN-03 y RN-05 de TESTS_ACEPTACION.feature (14 casos de salida y 8 de tarifa), como pruebas unitarias de `reglas` y como pruebas de la API.
- [ ] El paso 2 del asistente en la PWA muestra el precio y la salida al instante.

## Módulos a tocar
reglas (núcleo puro), configuracion (lectura de tarifas y reglas), estadías (endpoint de cotización), PWA (paso 2 del asistente).

## Verificación
`npm test -- --test-name-pattern="RN-0[1235]" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
