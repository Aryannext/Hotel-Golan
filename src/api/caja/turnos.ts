// Caja por turno (FR-11, FR-14; RN-09, RN-10, RN-11): ver el turno activo y recibirlo confirmando lo contado.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { finProgramadoTurno } from '../reglas/reglas.ts';
import { regla } from '../estadias/cotizaciones.ts';

type TipoTurno = 'DIA' | 'NOCHE';
interface FilaTurno {
  id: string; tipo: TipoTurno; estado: 'POR_RECIBIR' | 'ABIERTO' | 'CERRADO'; responsable: string | null; recibido_de: string | null;
  inicio_en: Date; fin_en: Date | null; base_entregada: number; base_recibida: number | null; pago_turno: number | null;
}

const SELECT_TURNO = `
  SELECT t.id, t.tipo, t.estado, r.usuario AS responsable, d.usuario AS recibido_de, t.inicio_en, t.fin_en,
         t.base_entregada, t.base_recibida, t.pago_turno
    FROM turnos t LEFT JOIN usuarios r ON r.id = t.responsable_id LEFT JOIN usuarios d ON d.id = t.recibido_de_id`;

async function turnoActivo(bd: Bd): Promise<FilaTurno | undefined> {
  const [t] = await bd.consultar<FilaTurno>(`${SELECT_TURNO} WHERE t.estado IN ('POR_RECIBIR', 'ABIERTO')`);
  return t;
}

/** Para cobrar o mover dinero hace falta un turno ABIERTO (RN-09). Lo usan cobros y movimientos de caja. */
export async function turnoAbiertoId(bd: Bd): Promise<string> {
  const [t] = await bd.consultar<{ id: string }>(`SELECT id FROM turnos WHERE estado = 'ABIERTO'`);
  if (!t) throw new ErrorApi(409, 'SIN_TURNO_ABIERTO', 'Todavía no hay un turno abierto. Primero hay que recibir el turno.');
  return t.id;
}

/** RN-10: debe haber = base recibida + efectivo en caja − salidas. Las transferencias van aparte; lo anulado no cuenta. */
async function resumenCaja(bd: Bd, t: FilaTurno) {
  const [p] = await bd.consultar<{ efectivo: number; transferencias: number; por_verificar: number }>(
    `SELECT coalesce(sum(valor) FILTER (WHERE estado = 'EN_CAJA'), 0)::int AS efectivo,
            coalesce(sum(valor) FILTER (WHERE estado IN ('POR_VERIFICAR', 'VERIFICADO')), 0)::int AS transferencias,
            count(*) FILTER (WHERE estado = 'POR_VERIFICAR')::int AS por_verificar
       FROM pagos WHERE turno_id = $1 AND anulado_en IS NULL`, [t.id]);
  const [m] = await bd.consultar<{ salidas: number }>(
    'SELECT coalesce(sum(valor), 0)::int AS salidas FROM movimientos_caja WHERE turno_id = $1 AND anulado_en IS NULL', [t.id]);
  // Mientras está por recibir, la referencia es lo que entregaron.
  const base = t.base_recibida ?? t.base_entregada;
  return {
    base_recibida: base, efectivo: p.efectivo, salidas: m.salidas, debe_haber: base + p.efectivo - m.salidas,
    transferencias: p.transferencias, por_verificar_cantidad: p.por_verificar,
    pago_turno: t.pago_turno ?? await regla(bd, t.tipo === 'DIA' ? 'pago_turno_dia' : 'pago_turno_noche'),
  };
}

async function respuestaTurno(bd: Bd, t: FilaTurno) {
  const inicio = new Date(t.inicio_en);
  return {
    id: t.id, tipo: t.tipo, estado: t.estado, responsable: t.responsable, recibido_de: t.recibido_de,
    inicio_en: aBogota(inicio), fin_en: t.fin_en ? aBogota(new Date(t.fin_en)) : null,
    fin_programado_en: aBogota(finProgramadoTurno(t.tipo, inicio)),
    base_entregada: t.base_entregada, base_recibida: t.base_recibida,
    caja: await resumenCaja(bd, t),
    cierre: null, // El cierre llega con la entrega del turno (TICKET-11).
  };
}

interface CuerpoRecepcion { base_contada: number; motivo_diferencia?: string }

export function rutasTurnos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get('/turnos/actual', { preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']) }, async () => {
    const t = await turnoActivo(bd);
    if (!t) throw new ErrorApi(404, 'NO_ENCONTRADO', 'No hay un turno activo.');
    return respuestaTurno(bd, t);
  });

  app.post<{ Body: CuerpoRecepcion }>('/turnos/actual/recepcion', {
    // La administración no recibe turnos (FR-13/FR-14).
    preHandler: requiere(bd, ahora, ['RECEPCION']),
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['base_contada'],
        properties: {
          base_contada: { type: 'integer', minimum: 0, maximum: 100000000 },
          motivo_diferencia: { type: 'string', minLength: 5, maxLength: 300 },
        },
      },
    },
  }, async (req) => {
    const u = req.usuario!;
    const { base_contada: contada } = req.body;
    const motivo = req.body.motivo_diferencia?.trim() || null;
    const momento = ahora();
    const id = await bd.transaccion(async (tx) => {
      const [t] = await tx.consultar<{ id: string; base_entregada: number }>(
        `SELECT id, base_entregada FROM turnos WHERE estado = 'POR_RECIBIR' FOR UPDATE`);
      if (!t) throw new ErrorApi(409, 'CONFLICTO', 'No hay un turno por recibir: ya lo recibió alguien o todavía no lo han entregado.');
      const diferencia = contada - t.base_entregada;
      if (diferencia !== 0 && !motivo) {
        throw new ErrorApi(422, 'MOTIVO_REQUERIDO', 'Lo que contó no coincide con lo que le entregaron. Escriba el motivo de la diferencia.');
      }
      // Solo un turno pasa de POR_RECIBIR a ABIERTO: si dos lo reciben a la vez, el segundo no encuentra la fila.
      const cambiadas = await tx.consultar<{ id: string }>(
        `UPDATE turnos SET estado = 'ABIERTO', responsable_id = $2, base_recibida = $3, motivo_diferencia_recepcion = $4, inicio_en = $5
          WHERE id = $1 AND estado = 'POR_RECIBIR' RETURNING id`,
        [t.id, u.id, contada, diferencia === 0 ? null : motivo, momento]);
      if (cambiadas.length === 0) throw new ErrorApi(409, 'CONFLICTO', 'Otra persona acaba de recibir el turno.');

      await auditar(tx, {
        usuarioId: u.id, accion: 'RECIBIR_TURNO', entidad: 'turnos', entidadId: t.id,
        detalle: { base_contada: String(contada), diferencia: String(diferencia) }, ocurrido: momento,
      });
      await tx.consultar('INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)',
        ['turno.recibido', JSON.stringify({ turno_id: t.id, recibido_por: u.usuario }), momento]);
      if (diferencia !== 0) {
        // Aviso a la administración (FR-14); llega por /eventos cuando exista el canal en vivo.
        await tx.consultar('INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)', ['turno.diferencia', JSON.stringify({
          turno_id: t.id, base_entregada: t.base_entregada, base_contada: contada, diferencia, recibido_por: u.usuario,
        }), momento]);
      }
      return t.id;
    });
    const [t] = await bd.consultar<FilaTurno>(`${SELECT_TURNO} WHERE t.id = $1`, [id]);
    return respuestaTurno(bd, t);
  });
}
