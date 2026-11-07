// POST /cotizaciones (FR-04): calcula precio y salida sin guardar nada. El servidor recalcula siempre (no confía en el cliente).
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { HABITACIONES } from '../comun/hotel.ts';
import { regla } from '../configuracion/reglas.ts';
import { requiere } from '../identidad/sesiones.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { cotizar, type ModalidadCotizable, type Tarifa, type TipoHabitacion } from '../reglas/reglas.ts';


/** Tarifas vigentes en un momento dado: la fila más reciente de cada combinación con vigente_desde ≤ momento. */
export async function tarifasVigentes(bd: Bd, momento: Date): Promise<Tarifa[]> {
  return bd.consultar<Tarifa>(
    `SELECT DISTINCT ON (tipo_habitacion, modalidad, personas) tipo_habitacion, modalidad, personas, valor
       FROM tarifas WHERE vigente_desde <= $1
      ORDER BY tipo_habitacion, modalidad, personas, vigente_desde DESC`, [momento]);
}

/**
 * Descuento por noche pedido: `valor_descuento` (lo elige recepción, hasta el máximo); si no viene,
 * `aplicar_descuento: true` sigue significando el máximo (compatibilidad con el contrato v0.3).
 */
export function descuentoPedido(b: { aplicar_descuento?: boolean; valor_descuento?: number }, maximo: number): number {
  return b.valor_descuento ?? (b.aplicar_descuento ? maximo : 0);
}

interface Cuerpo {
  habitacion_numero: string; modalidad: ModalidadCotizable; personas: number; noches?: number;
  aplicar_descuento?: boolean; valor_descuento?: number; entrada_en?: string;
}

export function rutasCotizaciones(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.post<{ Body: Cuerpo }>('/cotizaciones', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['habitacion_numero', 'modalidad', 'personas'],
        properties: {
          habitacion_numero: { type: 'string', enum: HABITACIONES },
          modalidad: { type: 'string', enum: ['NOCHE', 'TRES_HORAS'] },
          personas: { type: 'integer', minimum: 1, maximum: 3 },
          noches: { type: 'integer', minimum: 1, maximum: 30, default: 1 },
          aplicar_descuento: { type: 'boolean', default: false },
          valor_descuento: { type: 'integer', minimum: 0 },
          entrada_en: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (req) => {
    const b = req.body;
    const entrada = b.entrada_en ? new Date(b.entrada_en) : ahora();
    const [h] = await bd.consultar<{ tipo: TipoHabitacion }>('SELECT tipo FROM habitaciones WHERE numero = $1', [b.habitacion_numero]);
    if (!h) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La habitación no existe.');
    const maximo = await regla(bd, 'descuento_noche');
    const c = cotizar({
      tarifas: await tarifasVigentes(bd, entrada), descuentoNoche: maximo, tipo: h.tipo,
      modalidad: b.modalidad, personas: b.personas, noches: b.noches ?? 1, descuentoPorNoche: descuentoPedido(b, maximo), entrada,
    });
    return {
      tarifa: c.tarifa, descuento: c.descuento, total: c.total,
      salida_prevista_en: aBogota(c.salida), permite_pago_al_salir: c.permitePagoAlSalir, franja_salida: c.franja,
    };
  });
}
