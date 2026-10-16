# 07: Extender la estadía con la regla de las 4 p. m.

**ID:** TICKET-07
**Requisitos:** FR-08; RN-04 (docs/PRD.md; contrato en docs/CONTRATO_API.yaml; criterios en docs/TESTS_ACEPTACION.feature)

**What to build:** Si el huésped quiere seguir, la recepcionista elige otra noche, tres horas o por horas. Ve el valor y la nueva salida; si las horas pasan de las 4:00 p. m., el sistema cobra la noche completa en lugar de las horas.

**Blocked by:** TICKET-02 (Cotizar una estadía (precio y hora de salida)), TICKET-06 (Cargos y pagos en la cuenta de la habitación)

**Status:** done (16-10-2026)

## Invariantes de negocio
- $8.000 por hora empezada, en aire y en ventilador, solo como extensión.
- Extensión que pasa de las 4:00 p. m. → se cobra NOCHE (reemplaza las horas); otra noche suma 24 horas desde la salida actual.
- La extensión se calcula desde la salida actual o desde ahora, lo que sea mayor.
- Sin descuento en las extensiones por hora.
- Importes en COP enteros; nada de dinero se borra: se anula con usuario y motivo (ADR-008).
- Cada acción que cambia datos deja auditoría con usuario, hora, acción y entidad, sin datos personales (FR-20).
- Solo datos sintéticos en pruebas; nunca datos reales de huéspedes (Circular SIC 002 de 2024).
- Reglas de negocio evaluadas en America/Bogota; la base guarda timestamptz.

## Criterios de aceptación
- [x] POST /estadias/{id}/extensiones cumple el contrato.
- [x] Pasa el esquema «Extender después del mediodía» (1 h $8.000; 4 h $32.000; 5 h → $60.000 hasta mañana a las 12 m.).
- [x] La PWA advierte «Pasaría de las 4:00 p. m.: se cobra la noche completa».

## Módulos a tocar
reglas (extensión), estadías, PWA (extender).

## Verificación
`npm test -- --test-name-pattern="RN-04" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.

## Evidencia de cierre (16-10-2026)
- Núcleo `reglas`: `calcularExtension` (RN-04), que extiende desde la salida actual o desde ahora (lo que sea mayor). Por horas cobra $8.000 por hora (valor_hora); si la nueva salida pasa de las 4:00 p. m. (hora_noche_completa) del día en que empieza, cobra la noche completa y sale según RN-01. Otra noche cobra la tarifa por personas; tres horas, la de tres horas (máximo 2 personas). 8 pruebas puras.
- `estadias/extensiones.ts`: `POST /estadias/{id}/extensiones` (cargo EXTENSION con concepto claro, nueva salida, auditoría, evento e Idempotency-Key) y `POST /estadias/{id}/extensiones/cotizacion` (misma regla, sin guardar). 10 pruebas: el esquema «Extender después del mediodía» (1 h $8.000 → 1 p. m.; 4 h $32.000 → 4 p. m.; 5 h → $60.000 hasta mañana a las 12 m.), cotización sin cambios, otra noche, aviso en el cargo al pasar de las 4, tres horas con 3 personas → 422, validaciones 400/404, idempotencia y estadía cerrada → 409.
- Cambio aditivo al contrato: `CONTRATO_API.yaml` v0.3 agrega `POST /estadias/{id}/extensiones/cotizacion` y el esquema `CotizacionExtension` [P], para que la pantalla muestre el valor y la nueva salida sin repetir la regla.
- Decisión de diseño [P/V]: «otra noche» sigue la regla de salida desde que empieza. Con la salida a las 12 m. son 24 horas, como dice el ticket; con la salida vencida, se cobra como una noche que entra ahora (por ejemplo, desde las 4:23 p. m. sale mañana a las 12 m., no a las 4:23 p. m.). Así coincide con el caso de las horas que pasan de las 4. Está pendiente de confirmar con la administradora.
- PWA: «Extender» en la ficha de la habitación, con otra noche, 3 horas o por horas (contador de 1 a 12), cotización en vivo, aviso «Pasaría de las 4:00 p. m.: se cobra la noche completa.» y nueva salida en palabras. 1 prueba de lógica.
- Probado en el navegador contra Docker con la hora real (4:23 p. m.): en la 211 (ventilador, 3 personas), 1 hora mostró el aviso y $80.000 hasta mañana a las 12 m.; 3 horas mostró «máximo 2 personas»; otra noche quedó en $80.000, saldo de $108.000 y salida el 17/10 a las 12 m. Datos sintéticos restaurados con `npm run db:reiniciar`.
- `npm test`: 219 pruebas en verde (200 anteriores + 8 de reglas + 10 de API + 1 de presentación); tipos limpios.
