# Mediciones de usabilidad en el navegador (CP-042 a CP-050)

- Fecha: 2026-10-26, entre las 13:40 y las 14:05 (America/Bogota).
- Entorno: http://localhost:3001, `main` en dbd24b3, PostgreSQL de Docker con la semilla sintética.
- Navegador: panel de navegador de Claude (Chromium), emulando un ancho de **360 × 780 px**. Es el ancho mínimo que exige el PRD («pantallas para celular desde 360 px»).
- Usuarios: `recepcion2` y `admin`, de la semilla sintética.
- Método: scripts de medición ejecutados en la página. Recorren los controles visibles y miden su tamaño con `getBoundingClientRect`, el tamaño de letra y el contraste con `getComputedStyle`. Las acciones (escribir, cambiar de pestaña) se hicieron con clics y teclado reales del panel.

## Inicio de recepción (360 px)
- Controles visibles: 21. Por debajo de 44 px: 4.
  - Campana «Avisos»: 38 × 38.
  - «Cerrar sesión»: 135 × 42.
  - Pestaña «Habitaciones»: 103 × 36.
  - Pestaña «Caja»: 47 × 36.
- Contraste por debajo de 4,5:1: ninguno.
- Botones sin nombre accesible: 0. Campos sin etiqueta: 0.
- La página no se desplaza de lado.

## Caja (360 px), cuenta de recepción y de administración
- La tarjeta «En la caja debe haber» termina en x = 344 px.
- «Venta de contado» termina en x = 259 px y «Lavandería de afuera» en x = 259 px.
- «Salió plata» termina en **x = 418 px**: se sale de la tarjeta.
- Ancho del documento: **418 px**, con una ventana de 360 px. La página entera se desplaza de lado.
- Columnas de la rejilla de botones: `1fr 1fr`. Se calcularon como 223,4 px + 147,4 px, más ancho que la tarjeta.
- Captura: `DEF-001-caja-360px.jpg`.

## Nueva entrada, paso 1 (habitación 201)
- Letra de los campos:
  - nombre (`h-nombre`): 14,5 px;
  - tipo de documento: 14,5 px;
  - número de documento (`h-doc`): 14,5 px;
  - nacionalidad (`h-nac`): 14,5 px;
  - celular (`h-tel`): 14,5 px.
- Botón «Siguiente»: empieza en y = 1488 px, con una ventana de 780 px de alto. Hay que bajar **1,91 pantallas** para llegar a él.
- Campo de número de documento: `disabled = true` mientras no se elige el tipo. No tiene texto de ayuda, `placeholder` ni `aria-describedby` que lo explique.

### Se cambia de pestaña a mitad de la entrada
1. Se escribió «Huésped Prueba CF35» en «Nombre completo». Valor leído: `Huésped Prueba CF35`.
2. Se intentó escribir el número de documento: quedó vacío porque el campo estaba deshabilitado (ver arriba).
3. Se tocó la pestaña «Caja». No apareció ningún aviso ni pregunta (`avisoAntesDeSalir: false`).
4. Se volvió a «Habitaciones» y se abrió otra vez la 201. Nombre: vacío. **Lo escrito se perdió.**

## Navegación de la administración (360 px)
- Pestañas:
  - «Por confirmar»: x de 16 a 143;
  - «Habitaciones»: x de 147 a 247;
  - «Caja»: x de 251 a 296;
  - «Historial»: x de 300 a 368, **cortada**;
  - «Equipo»: x de 372 a 434, **fuera de la pantalla**;
  - «Ajustes»: x de 438 a 501, **fuera de la pantalla**.
- Barra con `overflow-x: auto`. No hay botón «Más» ni otra señal de que existen más pestañas.
- Alto de cada pestaña: 40 px.
- En «Por confirmar» hay **dos** títulos de nivel 1: «Pagos por confirmar» y «Solicitudes de factura».

## Cuenta de la habitación 205, como administración (360 px)
- Controles por debajo de 44 px:
  - «Cerrar»: 38 × 38;
  - «Daño»: 58 × 24;
  - «Agregar»: 76 × 24;
  - «Registrar pago»: 116 × 24;
  - «Anular pago de $55.000»: 32 × 32;
  - los seis botones de acción: 160 × 42.
- Los seis botones de acción tienen el mismo estilo (`btn--secundario`): Extender, Lavandería, Cambiar, Factura, Desiste y Dar salida.
- La cabecera dice «Huésped Prueba 01 · 2 personas · sale 13/10 12:00 m.». No indica que la salida ya se venció; en el mapa, la misma habitación dice «Ocupada · salida vencida».

## Lo que se cumple
- Contraste: ningún texto por debajo de 4,5:1 en el inicio ni en la Caja.
  - Se excluyen los textos sobre fondos con degradado, porque la medición no puede calcular su color de fondo. Ver INC-010.
- Todos los botones tienen un nombre accesible y todos los campos tienen su etiqueta.
- Las habitaciones se anuncian en voz alta con su estado y la acción, por ejemplo: «Habitación 201, Disponible, tocar para registrar una entrada».
