// GET /habitaciones (FR-01) y PUT /habitaciones/{numero}/estado (FR-02). La cuenta resumida sigue la regla del ticket 06:
// saldo = cargos − (pagos en caja o verificados + pagos por verificar); los rechazados y anulados no cuentan.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { aBogota } from '../comun/tiempo.ts';
import { auditar } from '../comun/auditoria.ts';
import { ErrorApi } from '../comun/errores.ts';

const ESTADOS = ['DISPONIBLE', 'OCUPADA', 'POR_REVISAR', 'LIMPIEZA', 'MANTENIMIENTO'] as const;
const NUMEROS = ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '301'] as const;

interface Fila {
  numero: string; tipo: string; estado: string; nota: string | null;
  estadia_id: string | null; nombre: string | null; anonimizado_en: Date | null; salida_prevista_en: Date | null;
  cargos: number; pagado: number; por_verificar: number;
}

export function nombreCorto(nombre: string | null, anonimizado: boolean): string {
  if (anonimizado || !nombre) return 'Huésped anonimizado';
  return nombre.trim().split(/\s+/).slice(0, 2).join(' ');
}

/** Habitaciones con su estadía activa resumida; con `numero`, solo esa. */
export async function leerHabitaciones(bd: Bd, ahora: Date, filtro: { estado?: string; numero?: string } = {}) {
  const filas = await bd.consultar<Fila>(
    `SELECT h.numero, h.tipo, h.estado, h.nota,
            e.id AS estadia_id, hu.nombre, hu.anonimizado_en, e.salida_prevista_en,
            coalesce((SELECT sum(c.valor) FROM cargos c WHERE c.estadia_id = e.id AND c.anulado_en IS NULL), 0)::int AS cargos,
            (coalesce((SELECT sum(p.valor) FROM pagos p WHERE p.estadia_id = e.id AND p.anulado_en IS NULL
                         AND p.estado IN ('EN_CAJA', 'VERIFICADO')), 0)
             -- Lo devuelto en efectivo por un cambio de habitación (TICKET-26) ya no cuenta como pagado.
             - coalesce((SELECT sum(m.valor) FROM movimientos_caja m WHERE m.estadia_id = e.id AND m.anulado_en IS NULL), 0))::int AS pagado,
            coalesce((SELECT sum(p.valor) FROM pagos p WHERE p.estadia_id = e.id AND p.anulado_en IS NULL
                        AND p.estado = 'POR_VERIFICAR'), 0)::int AS por_verificar
       FROM habitaciones h
       LEFT JOIN estadias e ON e.habitacion_numero = h.numero AND e.estado = 'ACTIVA'
       LEFT JOIN huespedes hu ON hu.id = e.huesped_id
      WHERE ($1::text IS NULL OR h.estado = $1) AND ($2::text IS NULL OR h.numero = $2)
      ORDER BY h.numero`,
    [filtro.estado ?? null, filtro.numero ?? null]);
  return filas.map((f) => ({
    numero: f.numero, tipo: f.tipo, estado: f.estado, nota: f.nota,
    estadia_activa: f.estadia_id && f.salida_prevista_en ? {
      id: f.estadia_id,
      nombre_corto: nombreCorto(f.nombre, !!f.anonimizado_en),
      salida_prevista_en: aBogota(new Date(f.salida_prevista_en)),
      saldo: Math.max(0, f.cargos - f.pagado - f.por_verificar),
      por_verificar: f.por_verificar,
      vencida: ahora > new Date(f.salida_prevista_en),
    } : null,
  }));
}

type EstadoManual = 'DISPONIBLE' | 'POR_REVISAR' | 'LIMPIEZA' | 'MANTENIMIENTO';
/** FR-02. OCUPADA solo la asigna el registro de una entrada; POR_REVISAR, la salida o el arreglo de un daño. */
export const TRANSICIONES: Record<string, EstadoManual[]> = {
  POR_REVISAR: ['LIMPIEZA', 'MANTENIMIENTO'],
  LIMPIEZA: ['DISPONIBLE'],
  MANTENIMIENTO: ['POR_REVISAR'],
};
const NOTA_POR_DEFECTO: Record<EstadoManual, string | null> = {
  LIMPIEZA: 'Limpieza normal', MANTENIMIENTO: 'Daño reportado en revisión', POR_REVISAR: 'Arreglada: revisar antes de ofrecerla', DISPONIBLE: null,
};
const enPalabras = (estado: string) => estado.toLowerCase().replace('_', ' ');

interface CuerpoEstado { estado: EstadoManual; nota?: string; limpieza_especial?: boolean }

export function rutasHabitaciones(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get<{ Querystring: { estado?: string } }>('/habitaciones', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      querystring: { type: 'object', additionalProperties: false, properties: { estado: { type: 'string', enum: [...ESTADOS] } } },
    },
  }, async (req) => ({ items: await leerHabitaciones(bd, ahora(), { estado: req.query.estado }) }));

  app.put<{ Params: { numero: string }; Body: CuerpoEstado }>('/habitaciones/:numero/estado', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      params: { type: 'object', required: ['numero'], properties: { numero: { type: 'string', enum: [...NUMEROS] } } },
      body: {
        type: 'object', additionalProperties: false, required: ['estado'],
        properties: {
          estado: { type: 'string', enum: ['DISPONIBLE', 'POR_REVISAR', 'LIMPIEZA', 'MANTENIMIENTO'] },
          nota: { type: 'string', maxLength: 200 },
          limpieza_especial: { type: 'boolean' },
        },
        // La limpieza especial (fluidos) solo tiene sentido al mandar a limpieza (RN-14).
        if: { required: ['limpieza_especial'], properties: { limpieza_especial: { const: true } } },
        then: { properties: { estado: { const: 'LIMPIEZA' } } },
      },
    },
  }, async (req) => {
    const { numero } = req.params;
    const { estado, limpieza_especial: especial } = req.body;
    const momento = ahora();
    await bd.transaccion(async (tx) => {
      const [h] = await tx.consultar<{ estado: string }>('SELECT estado FROM habitaciones WHERE numero = $1 FOR UPDATE', [numero]);
      if (!h) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La habitación no existe.');
      if (!(TRANSICIONES[h.estado] ?? []).includes(estado)) {
        throw new ErrorApi(409, 'TRANSICION_INVALIDA', `La habitación ${numero} está ${enPalabras(h.estado)}: no puede pasar a ${enPalabras(estado)}.`);
      }
      const nota = req.body.nota?.trim() || (especial ? 'Limpieza especial (fluidos)' : NOTA_POR_DEFECTO[estado]);
      await tx.consultar('UPDATE habitaciones SET estado = $2, nota = $3, actualizado_en = $4 WHERE numero = $1', [numero, estado, nota, momento]);
      await auditar(tx, {
        usuarioId: req.usuario!.id, accion: 'ACTUALIZAR', entidad: 'habitaciones', entidadId: numero,
        detalle: { de: h.estado, a: estado, ...(especial ? { limpieza_especial: 'si' } : {}) }, ocurrido: momento,
      });
      await tx.consultar('INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)',
        ['habitacion.actualizada', JSON.stringify({ numero, estado }), momento]);
    });
    const [hab] = await leerHabitaciones(bd, momento, { numero });
    return hab;
  });
}
