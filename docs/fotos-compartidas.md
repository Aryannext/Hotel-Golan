# Fotos compartidas del hotel

Las fotos nuevas se guardan en la base de datos del servidor, no en el navegador. Recepción puede leerlas; solo las cuentas de rol `ADMINISTRACION` (administradora y dueña) pueden reemplazarlas o eliminarlas. El servidor comprueba ese permiso en cada operación, aunque alguien intente saltarse los botones de la interfaz.

Todos los equipos deben conectarse al **mismo servidor/base de datos**. Si se traslada el sistema a otro servidor, trasladar también su base de datos y los archivos estáticos del proyecto. Dos instalaciones con bases independientes no se sincronizan por sí solas.

## Activación en PostgreSQL

```sh
npm install
npm run db:migrar
npm run web:build
npm run api:dev
```

Usar la configuración `.env` habitual del servidor. La migración `0014_fotos_compartidas.sql` agrega una tabla independiente y amplía la lista de eventos con `foto.actualizada`; no cambia importes ni reglas de caja, pagos o estadías. Reiniciar la API para registrar las nuevas rutas. Incluir la tabla en la copia habitual de PostgreSQL (`pg_dump` ya la incluye).

## Demo local aislada y persistente

La versión persistente funciona ahora en **http://127.0.0.1:3000/**. Por autorización expresa de la usuaria, sustituyó la demo antigua que guardaba los movimientos solo en memoria. Se conserva la misma base persistente que se probó inicialmente en 3001, incluidas sus fotos (Llave perdida y Agua) y sus movimientos; no se volvió a sembrar.

```sh
npm run web:build
npm run demo:persistente
```

Abrir `http://127.0.0.1:3000/`. Los usuarios y el PIN de la demo salen de la semilla (`SEMILLA_PIN_PRUEBA`); no se escriben aquí porque el repositorio es público. Su base se conserva en `.pglite/demo-compartida/`, excluida de Git. No borrar esa carpeta si se quieren conservar las fotos y movimientos de esta demo. No usar estas credenciales en producción. Se hizo una copia de la base cerrada antes del traslado en `copias/demo-antes-traslado-20261030-164812/`.

El puerto 3000 escucha solo en el equipo local. Para acceso desde otros equipos, desplegar el sistema en el servidor/red privada configurada para el hotel, con la misma base, usando el procedimiento habitual de acceso seguro del proyecto. `localhost` y `127.0.0.1` siempre se refieren al equipo desde el que se abre el navegador.

## Verificación

1. Entrar como Administración, abrir una cuenta, pulsar la cámara de un producto y subir una foto o tomarla.
2. Entrar como recepción desde otro navegador/equipo conectado al mismo servidor: debe ver la foto sin cámaras ni controles de edición. Los botones `+` para agregar un cargo siguen disponibles.
3. Reemplazar la foto como Administración: las otras sesiones se actualizan mediante el evento `foto.actualizada` y una consulta de respaldo cada 30 s/al recuperar el foco.
4. Reiniciar el servidor persistente: la fotografía debe mantenerse.

Pruebas automáticas: `node --test src/api/fotos.test.ts`; `npm run tipos`. Verifican sesiones distintas, acceso directo denegado a recepción, persistencia entre instancias, caché/versiones, validación de imágenes e importaciones antiguas.

## Datos y límites

- Se reciben JPG, PNG o WebP de hasta 5 MB y 20 MP. `sharp` decodifica y recodifica a JPEG de hasta 1200 px, sin EXIF. Se rechazan otros formatos, archivos disfrazados y animaciones.
- Las fotos se entregan por rutas autenticadas, con caché privada y versiones. La auditoría registra el recurso y tamaño, nunca el contenido de la foto.
- Al montar una foto antigua guardada localmente, una sesión de Administración la comparte si no hay ninguna versión en el servidor. La operación no sobrescribe una foto compartida ni restaura una eliminada. La copia local se conserva si falla la importación.
- Las fotos originales de cinco productos están incluidas como respaldo estático. Las nuevas subidas tienen prioridad. Agua ya tiene una foto compartida y se verificó su carga después del traslado a 3000.
- La cámara de computador usa permiso del navegador y necesita HTTPS o localhost. El teléfono conserva el input `capture=environment`. No se solicita audio.
