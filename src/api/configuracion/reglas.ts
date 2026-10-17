// Reglas numéricas configurables (FR-22): valor por hora, hora de la noche completa, descuento, pagos de turno y retención.
// Aplican a lo nuevo: los cargos ya hechos guardan su valor y cada turno guarda su pago al abrirse.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';

const LIMITES = {
  valor_hora: { minimum: 0, maximum: 1000000 },
  hora_noche_completa: { minimum: 12, maximum: 23 },
  descuento_noche: { minimum: 0, maximum: 1000000 },
  pago_turno_dia: { minimum: 0, maximum: 10000000 },
  pago_turno_noche: { minimum: 0, maximum: 10000000 },
  retencion_datos_dias: { minimum: 1, maximum: 3650 },
};
type Clave = keyof typeof LIMITES;
const CLAVES = Object.keys(LIMITES) as Clave[];

async function leerReglas(bd: Bd): Promise<Record<Clave, number>> {
  const filas = await bd.consultar<{ clave: Clave; valor: number }>('SELECT clave, valor FROM reglas');
  const valores = new Map(filas.map((f) => [f.clave, f.valor]));
  return Object.fromEntries(CLAVES.map((k) => [k, valores.get(k)])) as Record<Clave, number>;
}

export function rutasReglas(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get('/reglas', { preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']) }, async () => leerReglas(bd));

  app.patch<{ Body: Partial<Record<Clave, number>> }>('/reglas', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { body: {
      type: 'object', additionalProperties: false, minProperties: 1,
      properties: Object.fromEntries(CLAVES.map((k) => [k, { type: 'integer', ...LIMITES[k] }])),
    } },
  }, async (req) => {
    const momento = ahora();
    const cambios = Object.entries(req.body) as Array<[Clave, number]>;
    await bd.transaccion(async (tx) => {
      for (const [clave, valor] of cambios) {
        await tx.consultar('UPDATE reglas SET valor = $2, actualizado_por = $3, actualizado_en = $4 WHERE clave = $1',
          [clave, valor, req.usuario!.id, momento]);
      }
      await auditar(tx, {
        usuarioId: req.usuario!.id, accion: 'ACTUALIZAR', entidad: 'reglas', entidadId: 'reglas', ocurrido: momento,
        detalle: Object.fromEntries(cambios.map(([k, v]) => [k, String(v)])),
      });
    });
    return leerReglas(bd);
  });
}
