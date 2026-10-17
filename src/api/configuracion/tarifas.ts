// Tarifas con vigencia (FR-22, RN-02, RN-03): un cambio crea filas nuevas con vigente_desde = ahora.
// Las filas anteriores no se tocan: lo cotizado o registrado antes conserva su precio.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { ErrorApi } from '../comun/errores.ts';
import { aBogota } from '../comun/tiempo.ts';

interface TarifaInput { tipo_habitacion: 'AIRE' | 'VENTILADOR'; modalidad: 'NOCHE' | 'TRES_HORAS'; personas: number; valor: number }
interface FilaTarifa extends TarifaInput { id: string; vigente_desde: Date }

const combinacion = (t: TarifaInput) => `${t.tipo_habitacion} ${t.modalidad} ${t.personas}`;

async function vigentes(bd: Bd, momento: Date) {
  const filas = await bd.consultar<FilaTarifa>(
    `SELECT * FROM (
       SELECT DISTINCT ON (tipo_habitacion, modalidad, personas) id, tipo_habitacion, modalidad, personas, valor, vigente_desde
         FROM tarifas WHERE vigente_desde <= $1
        ORDER BY tipo_habitacion, modalidad, personas, vigente_desde DESC) v
      ORDER BY tipo_habitacion, modalidad, personas`, [momento]);
  return { items: filas.map((f) => ({ ...f, vigente_desde: aBogota(new Date(f.vigente_desde)) })) };
}

export function rutasTarifas(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get('/tarifas', { preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']) }, async () => vigentes(bd, ahora()));

  app.put<{ Body: { items: TarifaInput[] } }>('/tarifas', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['items'],
      properties: { items: { type: 'array', minItems: 1, maxItems: 20, items: {
        type: 'object', additionalProperties: false, required: ['tipo_habitacion', 'modalidad', 'personas', 'valor'],
        properties: {
          tipo_habitacion: { type: 'string', enum: ['AIRE', 'VENTILADOR'] },
          modalidad: { type: 'string', enum: ['NOCHE', 'TRES_HORAS'] },
          personas: { type: 'integer', minimum: 1, maximum: 3 },
          valor: { type: 'integer', minimum: 1, maximum: 10000000 },
        },
      } } },
    } },
  }, async (req) => {
    const { items } = req.body;
    // RN-03: tres horas tiene un solo precio para 1 o 2 personas, guardado con personas = 2.
    if (items.some((t) => t.modalidad === 'TRES_HORAS' && t.personas !== 2)) {
      throw new ErrorApi(400, 'INVALID_PAYLOAD', 'Tres horas tiene un solo precio para 1 o 2 personas: envíelo con personas = 2.');
    }
    if (new Set(items.map(combinacion)).size !== items.length) {
      throw new ErrorApi(400, 'INVALID_PAYLOAD', 'Hay una tarifa repetida: cada tipo, modalidad y número de personas va una sola vez.');
    }
    const momento = ahora();
    await bd.transaccion(async (tx) => {
      for (const t of items) {
        // Dos cambios en el mismo instante quedan como uno solo (el último).
        await tx.consultar(
          `INSERT INTO tarifas (tipo_habitacion, modalidad, personas, valor, vigente_desde) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tipo_habitacion, modalidad, personas, vigente_desde) DO UPDATE SET valor = EXCLUDED.valor`,
          [t.tipo_habitacion, t.modalidad, t.personas, t.valor, momento]);
      }
      await auditar(tx, {
        usuarioId: req.usuario!.id, accion: 'ACTUALIZAR', entidad: 'tarifas', entidadId: aBogota(momento), ocurrido: momento,
        detalle: Object.fromEntries(items.map((t) => [combinacion(t), String(t.valor)])),
      });
    });
    return vigentes(bd, momento);
  });
}
