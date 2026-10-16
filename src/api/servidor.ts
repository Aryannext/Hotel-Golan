// Punto de entrada: npm run api:dev (desarrollo) o node src/api/servidor.ts (VPS).
// Escucha solo en 127.0.0.1; en el VPS, tailscale serve lo publica dentro de la red privada (ADR-002).
import { join } from 'node:path';
import { conectarPostgres } from '../../scripts/lib/bd.ts';
import { construirApp } from './app.ts';

const bd = conectarPostgres();
const app = await construirApp({ bd, dirWeb: join(import.meta.dirname, '..', '..', 'dist', 'web'), registros: true });
const puerto = Number(process.env.API_PUERTO ?? 3000);
await app.listen({ host: '127.0.0.1', port: puerto });

for (const senal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(senal, async () => {
    await app.close();
    await bd.cerrar();
    process.exit(0);
  });
}
