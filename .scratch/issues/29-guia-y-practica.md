# 29: Guía corta de uso y sesión de práctica

**ID:** TICKET-29
**Requisitos:** SOW parte 12; PRD §3 («Capacitación y guía de uso», actividad, no software); auditoría HG-AUD-001, H-04

**What to build:** Una guía corta, con capturas de pantalla, para que recepción y la administración usen el sistema sin ayuda. Una sesión de práctica con el personal en el sistema ya instalado, usando datos ficticios.

**Blocked by:** TICKET-19 (Desplegar en el VPS). TICKET-28 (Aviso de privacidad), para que la guía muestre el texto aprobado.

**Status:** ready-for-agent

## Contenido de la guía (casos del día, en lenguaje sencillo)
- **Recepción:**
  - recibir el turno;
  - registrar una entrada (con el aviso);
  - agregar consumos y daños;
  - cobrar (efectivo y transferencias);
  - extender;
  - cambiar de habitación;
  - dar salida y revisar la habitación;
  - lavandería (huésped y de afuera);
  - venta de contado;
  - solicitud de factura;
  - «Salió plata»;
  - entregar el turno.
- **Administración:**
  - confirmar transferencias;
  - pasar facturas al contador;
  - historial y resumen del día;
  - usuarios y PIN;
  - precios y catálogo;
  - surtido y existencias;
  - anulaciones.
- **Si se cae el internet:** talonario de respaldo y registro tardío (ADR-010).

## Invariantes
- Sin siglas ni términos técnicos. La administradora no sabe de tecnología (HG-ACT-001, T3-6).
- Las capturas usan solo datos ficticios; nunca huéspedes reales.
- La guía no promete funciones que no existan.

## Criterios de aceptación
- [ ] La guía está en `docs/` y cada caso tiene sus pasos y al menos una captura.
- [ ] Se hizo la sesión de práctica, con fecha y asistentes en el acta [V].
- [ ] Las dudas de la práctica quedan anotadas como pendientes o como ajustes.

## Módulos a tocar
documentación (guía), sesión de práctica (actividad).

## Verificación
Revisión de la guía por el usuario; acta de la práctica.
