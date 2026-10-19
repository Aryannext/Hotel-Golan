# 36: El documento del titular es obligatorio (registro de huéspedes)

**ID:** TICKET-36
**Requisitos:** FR-03; RN-16; ADR-006 (docs/PRD.md v0.7; investigación HG-PRIV-002 §1, filas 1 y 4; aviso HG-PRIV-001 v0.4)

**What to build:** Al registrar una entrada, el titular debe dar el **tipo y el número de su documento**, además del nombre y la nacionalidad que ya se piden. La API rechaza la entrada sin documento, y la pantalla deja de decir «opcional». El teléfono sigue siendo opcional.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

## Por qué
La ley obliga a los hoteles a llevar el registro de huéspedes con la Tarjeta de Registro de Alojamiento (Ley 2068 de 2020, art. 22). Ese registro pide como mínimo el nombre, el tipo y el número de documento, la nacionalidad y las fechas de entrada y salida (Decreto 2119 de 2018) [V]. Antes el documento era opcional (RN-16, T3-5). **La ley prevalece sobre lo que pida el hotel** (indicación del usuario, 18-10-2026). La dueña aprobó el aviso que lo dice así (HG-ACT-001 V6-09).

## Invariantes de negocio
- `POST /estadias` sin `tipo_documento` o sin `numero_documento` en el titular → **422** `VALIDACION`. Aplica también al registro tardío (TICKET-18).
- Los tipos siguen siendo CC, CE, TI, RC, PASAPORTE y PPT. Si el asesor pide otro (por ejemplo, salvoconducto), se agrega por migración [V].
- Menor de edad: su documento es el registro civil o la tarjeta de identidad. Las reglas del acompañante (RN-16) no cambian.
- Las estadías ya guardadas sin documento y los huéspedes anonimizados siguen siendo válidos. Si se agrega una restricción en la base, se crea con `NOT VALID` o solo para las filas nuevas.
- El teléfono sigue opcional.
- Solo datos sintéticos en pruebas.

## Fuera de alcance [V]
- **Los acompañantes.** Hoy solo se registra al titular (RN-16). Si la TRA exige registrar a cada huésped, se abre otro ticket cuando lo confirme el asesor o el contador (HG-PRIV-001 §3).
- Enviar los datos a la TRA del Ministerio de Comercio. El sistema no la reemplaza.

## Criterios de aceptación
- [ ] Una entrada sin documento → 422. Con documento → 201, igual que antes.
- [ ] El registro tardío sin documento → 422.
- [ ] En el paso del titular, «Tipo de documento» y «Número» son obligatorios. Si faltan, el error dice «Escriba el documento: lo pide la ley para registrar al huésped».
- [ ] Las pruebas que registran titulares sin documento se actualizan a la regla nueva. Esto no debilita las pruebas: cambia la especificación. La lista para la policía deja de tener el caso «Sin documento» para entradas nuevas, pero lo conserva para las estadías antiguas.
- [ ] CONTRATO_API pasa a v0.5.0. El cambio rompe compatibilidad: `EstadiaInput.huesped.required` agrega el tipo y el número de documento.

## Módulos a tocar
estadías (esquema de entrada), PWA (paso del titular, `logica.ts`), pruebas de entrada y de registro tardío, CONTRATO_API, TESTS_ACEPTACION (RN-16).

## Verificación
`npm test -- --test-name-pattern="FR-03|RN-16|documento" && npm run tipos`; entrada en el navegador sin documento y con documento.

## Reglas de construcción (Fase 3)
- TDD: primero la prueba que falla por falta de la funcionalidad, luego el código y por último la prueba en verde.
- Circuit breaker: si una prueba falla 3 veces seguidas con hipótesis distintas, se detiene el ticket, se guarda la evidencia y se marca BLOCKED.
- Prohibido debilitar o borrar una prueba para que pase.
