// Rutas /sesiones (CONTRATO_API.yaml: iniciarSesion, obtenerSesionActual, cerrarSesion).
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { COOKIE, DURACION_SESION_MS, cerrarSesion, iniciarSesion, requiere, sesionActual } from './sesiones.ts';

export function rutasIdentidad(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const autenticado = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);

  app.post<{ Body: { usuario: string; pin: string } }>('/sesiones', {
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['usuario', 'pin'],
        properties: { usuario: { type: 'string', minLength: 3, maxLength: 40 }, pin: { type: 'string', pattern: '^[0-9]{6}$' } },
      },
    },
  }, async (req, rep) => {
    const { token, usuario } = await iniciarSesion(bd, ahora(), req.body.usuario, req.body.pin);
    rep.setCookie(COOKIE, token, {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: DURACION_SESION_MS / 1000,
    });
    return rep.code(201).send(await sesionActual(bd, usuario));
  });

  app.get('/sesiones/actual', { preHandler: autenticado }, async (req) => sesionActual(bd, req.usuario!));

  app.delete('/sesiones/actual', { preHandler: autenticado }, async (req, rep) => {
    await cerrarSesion(bd, ahora(), req.usuario!);
    rep.clearCookie(COOKIE, { path: '/' });
    return rep.code(204).send();
  });
}
