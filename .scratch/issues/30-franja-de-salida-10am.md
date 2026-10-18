# 30: Nueva franja de salida: desde las 10:00 a. m., a las 12 m. del día siguiente

**ID:** TICKET-30
**Requisitos:** FR-04, FR-03; RN-01 (docs/PRD.md v0.6; fuente: HG-ACT-001 §11 V5-11 a V5-13)

**What to build:** La cotización y la entrada calculan la salida de la noche con la regla que confirmó la administradora. Quien entra de 6:01 a 9:59 a. m. tiene 24 horas. Desde las 10:00 a. m., sale a las 12 m. del día siguiente.

**Blocked by:** None (can start immediately).

**Status:** done

## Regla (18-10-2026)
| Entrada | Salida con 1 noche | Franja |
|---|---|---|
| 12:00 a 6:00 a. m. | 12 m. del mismo día | MADRUGADA_MISMO_DIA |
| 6:01 a 9:59 a. m. | 24 horas después | VEINTICUATRO_HORAS |
| 10:00 a. m. a 11:59 p. m. | 12 m. del día siguiente | MEDIODIA_SIGUIENTE |

Con N noches se suman N−1 días (o N × 24 horas en la franja de 24 horas), como hoy. Valor anterior: 24 horas de 6:01 a 11:59 a. m. (T3-1, T3-2).

## Invariantes de negocio
- Las estadías ya registradas conservan su salida prevista: el cambio aplica a cotizaciones y entradas nuevas.
- Aplica igual al registro tardío, con la hora real de entrada (ADR-010).
- Si la hora límite (10:00 a. m.) se lleva a la configuración o queda fija en el código, se decide al construir [P]. La administradora no pidió cambiarla.
- Reglas evaluadas en America/Bogota.

## Criterios de aceptación
- [x] Entrar a las 9:59 a. m. con 1 noche: sale a las 9:59 a. m. del día siguiente.
- [x] Entrar a las 10:00 a. m. o a las 11:00 a. m. con 1 noche: sale a las 12:00 m. del día siguiente, en la franja MEDIODIA_SIGUIENTE.
- [x] Entrar a las 10:00 a. m. con 2 noches: sale a las 12:00 m. de dos días después.
- [x] Los ejemplos de RN-01 de docs/TESTS_ACEPTACION.feature v0.4 pasan en las pruebas de reglas.
- [x] Los textos de ayuda de la PWA que expliquen la franja (si los hay) dicen «desde las 10:00 a. m.».

## Módulos a tocar
reglas (cálculo de la salida), sus pruebas, textos de ayuda de la PWA.

## Verificación
`npm test -- --test-name-pattern="RN-01" && npm run tipos`

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase. Las pruebas viejas de 10:00 y 11:59 a. m. se **cambian** porque cambió la regla (V5-13); no se borran.
