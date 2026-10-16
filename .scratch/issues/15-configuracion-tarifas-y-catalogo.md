# 15: Configuración: tarifas, reglas y catálogo

**ID:** TICKET-15
**Requisitos:** FR-22 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** La administradora cambia tarifas, el valor por hora, el descuento, los pagos de turno y los productos con su precio. Los cambios aplican a lo nuevo, nunca a lo ya registrado.

**Blocked by:** TICKET-02 (Cotizar una estadía (precio y hora de salida)), TICKET-06 (Cargos y pagos en la cuenta de la habitación)

**Status:** ready-for-agent

## Invariantes de negocio
- Tarifas con vigencia: un cambio crea filas nuevas con `vigente_desde`; las cotizaciones usan la vigente en la hora de entrada.
- Los cargos ya hechos conservan su precio.
- Solo ADMINISTRACION.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [ ] PUT /tarifas, GET y PATCH /reglas, POST y PUT /productos cumplen el contrato.
- [ ] Una prueba demuestra que cambiar un precio no altera un cargo anterior.

## Módulos a tocar
configuracion, PWA (pantalla de configuración).

## Verificación
`npm test -- --test-name-pattern="FR-22|configuraci" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
