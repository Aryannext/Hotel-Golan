// Punto de entrada: npm run api:dev (desarrollo) o node src/api/servidor.ts (VPS).
// Escucha solo en 127.0.0.1; en el VPS, tailscale serve lo publica dentro de la red privada (ADR-002).
import { join } from 'node:path';
import { conectarPostgres } from '../../scripts/lib/bd.ts';
import { construirApp } from './app.ts';
import { programarAnonimizacion } from './privacidad/anonimizacion.ts';

let alFallarBd = (error: Error) => console.error('Falló una conexión con la base:', error.message);
const bd = conectarPostgres(undefined, (error) => alFallarBd(error));
const app = await construirApp({ bd, dirWeb: join(import.meta.dirname, '..', '..', 'dist', 'web'), registros: true });
alFallarBd = (error) => app.log.error({ mensaje: error.message }, 'Falló una conexión con la base');
// HG-HAL-001 HAL-06: un error que nadie atendió deja el proceso en un estado dudoso. Se registra y se termina;
// el servicio del VPS (TICKET-19) lo vuelve a levantar.
for (const evento of ['unhandledRejection', 'uncaughtException'] as const) {
  process.on(evento, (error) => {
    app.log.fatal({ mensaje: error instanceof Error ? error.message : String(error) }, `Error no atendido (${evento})`);
    process.exit(1);
  });
}
const puerto = Number(process.env.API_PUERTO ?? 3000);
await app.listen({ host: '127.0.0.1', port: puerto });

// FR-21: borra los datos de huéspedes vencidos al arrancar y luego cada hora (idempotente).
const detenerAnonimizacion = programarAnonimizacion(bd, () => new Date(), {
  alTerminar: (r) => { if (r.anonimizados > 0) app.log.info({ anonimizados: r.anonimizados }, 'Anonimización de huéspedes'); },
  alFallar: (error) => app.log.error(error, 'Falló la anonimización de huéspedes'),
});

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, async () => {
    detenerAnonimizacion();
    await app.close();
    await bd.cerrar();
    process.exit(0);
  });
}
