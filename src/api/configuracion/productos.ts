// Catálogo para cargos (FR-06). Crear y editar productos llega con la configuración (TICKET-15).
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';

export function rutasProductos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get('/productos', { preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']) }, async () => ({
    items: await bd.consultar(
      `SELECT id, nombre, grupo, precio, seccion, pertenece_a, activo FROM productos WHERE activo ORDER BY grupo, nombre`),
  }));
}
