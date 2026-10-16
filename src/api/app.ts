// Construye la API (monolito modular, ADR-001). Se usa igual en el servidor y en las pruebas (inject).
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import estaticos from '@fastify/static';
import type { Bd } from '../../scripts/lib/bd.ts';
import { ErrorApi } from './comun/errores.ts';
import { rutasIdentidad } from './identidad/rutas.ts';
import { rutasHabitaciones } from './habitaciones/rutas.ts';

export type App = FastifyInstance;

export interface OpcionesApp {
  bd: Bd;
  /** Reloj inyectable; las pruebas lo controlan. */
  ahora?: () => Date;
  /** Carpeta con la PWA compilada (dist/web). Si existe, la API la sirve. */
  dirWeb?: string;
  registros?: boolean;
}

export async function construirApp(o: OpcionesApp): Promise<App> {
  const ahora = o.ahora ?? (() => new Date());
  const app = Fastify({
    logger: o.registros ? { level: 'info', redact: ['req.headers.cookie', 'req.body.pin'] } : false,
    // additionalProperties: false debe rechazar, no borrar en silencio (CONTRATO_API).
    ajv: { customOptions: { removeAdditional: false, coerceTypes: 'array' } },
  });
  await app.register(cookie);

  app.setErrorHandler((error: FastifyError | ErrorApi, req, rep) => {
    if (error instanceof ErrorApi) return rep.code(error.estado).send({ codigo: error.codigo, mensaje: error.message });
    if ('validation' in error && error.validation) {
      return rep.code(400).send({
        codigo: 'INVALID_PAYLOAD',
        mensaje: 'Los datos enviados no son válidos.',
        detalles: error.validation.map((v) => ({ campo: v.instancePath || String(v.params?.missingProperty ?? ''), problema: v.message ?? 'inválido' })),
      });
    }
    req.log.error(error);
    return rep.code(500).send({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intente de nuevo.' });
  });

  await app.register(async (api) => {
    rutasIdentidad(api, o.bd, ahora);
    rutasHabitaciones(api, o.bd, ahora);
  }, { prefix: '/api/v1' });

  const conWeb = !!o.dirWeb && existsSync(o.dirWeb);
  // wildcard (por defecto): sirve también los archivos publicados después de arrancar (cada build cambia los nombres).
  if (conWeb) await app.register(estaticos, { root: o.dirWeb! });

  app.setNotFoundHandler((req, rep) => {
    // Rutas de la PWA (p. ej. /habitaciones) caen en index.html; la API responde 404 en JSON.
    // Un archivo (con extensión) que no existe es un 404 real; solo las rutas de la app reciben index.html.
    const ruta = req.url.split('?')[0];
    const esRutaDeApp = !ruta.startsWith('/api/') && !/\.[a-z0-9]+$/i.test(ruta);
    if (conWeb && req.method === 'GET' && esRutaDeApp) return rep.sendFile('index.html');
    return rep.code(404).send({ codigo: 'NO_ENCONTRADO', mensaje: 'No se encontró lo que busca.' });
  });

  await app.ready();
  return app;
}
