// Datos del hotel para el aviso de privacidad (TICKET-28; FR-05, RN-16; ADR-006): responsable, NIT, Registro Nacional de
// Turismo, dirección y teléfono. No van en el código, que es público: la administración los escribe en Ajustes y la
// entrada los muestra en la política completa. La auditoría guarda qué campos cambiaron, sin los valores.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';

const CAMPOS = ['responsable', 'nit', 'rnt', 'direccion', 'telefono'] as const;
type Campo = typeof CAMPOS[number];
type Datos = Record<Campo, string | null>;

// Los mismos límites que la migración 0010; vacío = sin dato.
const ESQUEMA: Record<Campo, object> = {
  responsable: { type: 'string', maxLength: 120, pattern: String.raw`^(\s*|.{3,120})$` },
  nit: { type: 'string', pattern: String.raw`^(\s*|[0-9.-]{5,20})$` },
  rnt: { type: 'string', pattern: String.raw`^(\s*|[0-9]{3,10})$` },
  direccion: { type: 'string', maxLength: 120, pattern: String.raw`^(\s*|.{5,120})$` },
  telefono: { type: 'string', pattern: String.raw`^(\s*|[0-9]{7,10})$` },
};

async function leer(bd: Bd): Promise<Datos> {
  const [f] = await bd.consultar<Datos>('SELECT responsable, nit, rnt, direccion, telefono FROM datos_hotel');
  return Object.fromEntries(CAMPOS.map((c) => [c, f?.[c] ?? null])) as Datos;
}

export function rutasDatosHotel(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get('/hotel', { preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']) }, async () => leer(bd));

  app.put<{ Body: Record<Campo, string> }>('/hotel', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { body: { type: 'object', additionalProperties: false, required: [...CAMPOS], properties: ESQUEMA } },
  }, async (req) => {
    const nuevos = Object.fromEntries(CAMPOS.map((c) => [c, req.body[c].trim() || null])) as Datos;
    const momento = ahora();
    await bd.transaccion(async (tx) => {
      const antes = await leer(tx);
      const cambiados = CAMPOS.filter((c) => antes[c] !== nuevos[c]);
      if (cambiados.length === 0) return;
      await tx.consultar(
        `UPDATE datos_hotel SET responsable = $1, nit = $2, rnt = $3, direccion = $4, telefono = $5, actualizado_por = $6, actualizado_en = $7`,
        [...CAMPOS.map((c) => nuevos[c]), req.usuario!.id, momento]);
      await auditar(tx, { usuarioId: req.usuario!.id, accion: 'ACTUALIZAR', entidad: 'datos_hotel', entidadId: 'datos_hotel',
        detalle: { campos: cambiados.join(', ') }, ocurrido: momento });
    });
    return leer(bd);
  });
}
