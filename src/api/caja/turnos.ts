// Caja por turno (FR-11, FR-13, FR-14; RN-09, RN-10, RN-11): ver el turno activo, entregarlo con conteo y recibirlo confirmando lo contado.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { COOKIE, cerrarSesion, requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { finProgramadoTurno } from '../reglas/reglas.ts';
import { regla } from '../configuracion/reglas.ts';
import { leerPagos } from '../cobros/pagos.ts';
import { leerMovimientos } from './movimientos.ts';
import { publicarEventos } from '../comun/eventos.ts';

type TipoTurno = 'DIA' | 'NOCHE';
interface FilaTurno {
  id: string; tipo: TipoTurno; estado: 'POR_RECIBIR' | 'ABIERTO' | 'CERRADO'; responsable: string | null; recibido_de: string | null;
  inicio_en: Date; fin_en: Date | null; base_entregada: number; base_recibida: number | null; pago_turno: number | null;
  pago_tomado: boolean | null; efectivo_esperado: number | null; efectivo_contado: number | null; motivo_diferencia: string | null;
  cerrado_por: string | null; motivo_cierre: string | null;
}

const SELECT_TURNO = `
  SELECT t.id, t.tipo, t.estado, r.usuario AS responsable, d.usuario AS recibido_de, t.inicio_en, t.fin_en,
         t.base_entregada, t.base_recibida, t.pago_turno, t.pago_tomado, t.efectivo_esperado, t.efectivo_contado, t.motivo_diferencia,
         c.usuario AS cerrado_por, t.motivo_cierre
    FROM turnos t LEFT JOIN usuarios r ON r.id = t.responsable_id LEFT JOIN usuarios d ON d.id = t.recibido_de_id
         LEFT JOIN usuarios c ON c.id = t.cerrado_por_id`;

async function turnoActivo(bd: Bd): Promise<FilaTurno | undefined> {
  const [t] = await bd.consultar<FilaTurno>(`${SELECT_TURNO} WHERE t.estado IN ('POR_RECIBIR', 'ABIERTO')`);
  return t;
}

export { turnoAbiertoId } from './abierto.ts';

/**
 * ADR-010 (V5-16): la plata de un registro tardío es del turno en que entró el huésped. Devuelve el turno abierto o
 * cerrado cuyo periodo contiene `entrada`; null si ninguno lo cubre (entonces va al abierto).
 */
export async function turnoDeEntrada(bd: Bd, entrada: Date): Promise<{ id: string; cerrado: boolean } | null> {
  const [t] = await bd.consultar<{ id: string; estado: string }>(
    `SELECT id, estado FROM turnos
      WHERE inicio_en <= $1 AND (fin_en > $1 OR (fin_en IS NULL AND estado = 'ABIERTO'))
      ORDER BY inicio_en DESC LIMIT 1`, [entrada]);
  return t ? { id: t.id, cerrado: t.estado === 'CERRADO' } : null;
}

/** Lo que debía haber al entregar con lo registrado después (un registro tardío, una anulación). El cierre original no cambia. */
function ajusteCierre(t: FilaTurno, caja: { debe_haber: number }) {
  const esperado = caja.debe_haber - (t.pago_tomado ? t.pago_turno ?? 0 : 0);
  return { efectivo_esperado_ajustado: esperado, diferencia_ajustada: (t.efectivo_contado ?? 0) - esperado };
}

/** Diferencia ajustada de un turno cerrado (para el aviso del registro tardío). */
export async function diferenciaAjustada(bd: Bd, turnoId: string): Promise<number> {
  const [t] = await bd.consultar<FilaTurno>(`${SELECT_TURNO} WHERE t.id = $1`, [turnoId]);
  return ajusteCierre(t, await resumenCaja(bd, t)).diferencia_ajustada;
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
    pago_turno: await pagoDelTurno(bd, t),
  };
}

async function respuestaTurno(bd: Bd, t: FilaTurno) {
  const inicio = new Date(t.inicio_en);
  const caja = await resumenCaja(bd, t);
  return {
    id: t.id, tipo: t.tipo, estado: t.estado, responsable: t.responsable, recibido_de: t.recibido_de,
    inicio_en: aBogota(inicio), fin_en: t.fin_en ? aBogota(new Date(t.fin_en)) : null,
    fin_programado_en: aBogota(finProgramadoTurno(t.tipo, inicio)),
    base_entregada: t.base_entregada, base_recibida: t.base_recibida,
    caja,
    cierre: t.estado === 'CERRADO' ? {
      pago_tomado: t.pago_tomado, efectivo_esperado: t.efectivo_esperado, efectivo_contado: t.efectivo_contado,
      diferencia: (t.efectivo_contado ?? 0) - (t.efectivo_esperado ?? 0), motivo_diferencia: t.motivo_diferencia, entregado_por: t.cerrado_por ?? t.responsable, motivo_cierre: t.motivo_cierre,
      ...ajusteCierre(t, caja),
    } : null,
  };
}

interface CuerpoRecepcion { base_contada: number; motivo_diferencia?: string }
interface CuerpoEntrega { pago_tomado: boolean; efectivo_contado: number; motivo_diferencia?: string; motivo_cierre?: string }

const pagoDelTurno = async (bd: Bd, t: FilaTurno) => t.pago_turno ?? regla(bd, t.tipo === 'DIA' ? 'pago_turno_dia' : 'pago_turno_noche');

export function rutasTurnos(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get<{ Querystring: { limite?: number; desplazamiento?: number } }>('/turnos', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { querystring: {
      type: 'object', additionalProperties: false,
      properties: {
        limite: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        desplazamiento: { type: 'integer', minimum: 0, default: 0 },
      },
    } },
  }, async (req) => {
    const [{ total }] = await bd.consultar<{ total: number }>('SELECT count(*)::int AS total FROM turnos');
    const filas = await bd.consultar<FilaTurno>(`${SELECT_TURNO} ORDER BY t.inicio_en DESC, t.id DESC LIMIT $1 OFFSET $2`,
      [req.query.limite, req.query.desplazamiento]);
    return { items: await Promise.all(filas.map((t) => respuestaTurno(bd, t))), total };
  });

  app.get<{ Params: { id: string } }>('/turnos/:id', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } },
  }, async (req) => {
    const [t] = await bd.consultar<FilaTurno>(`${SELECT_TURNO} WHERE t.id = $1`, [req.params.id]);
    if (!t) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El turno no existe.');
    return { ...await respuestaTurno(bd, t), pagos: await leerPagos(bd, { turnoId: t.id }),
      movimientos_caja: await leerMovimientos(bd, { turnoId: t.id }) };
  });

  app.get('/turnos/actual', { preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']) }, async () => {
    const t = await turnoActivo(bd);
    if (!t) throw new ErrorApi(404, 'NO_ENCONTRADO', 'No hay un turno activo.');
    return respuestaTurno(bd, t);
  });

  // Entregar el turno (FR-13; RN-11): conteo obligatorio y motivo si no cuadra. Cierra el turno, deja el siguiente
  // «por recibir» con lo contado y cierra la sesión de quien entrega. El sistema no descuenta nada de nómina.
  // Si quien lo tenía se fue sin entregarlo, la administración cuenta y lo cierra con `motivo_cierre` (HAL-18 [P/V]);
  // su sesión sigue abierta.
  app.post<{ Body: CuerpoEntrega }>('/turnos/actual/entrega', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['pago_tomado', 'efectivo_contado'],
        properties: {
          pago_tomado: { type: 'boolean' },
          efectivo_contado: { type: 'integer', minimum: 0, maximum: 100000000 },
          motivo_diferencia: { type: 'string', minLength: 5, maxLength: 300 },
          motivo_cierre: { type: 'string', minLength: 5, maxLength: 300 },
        },
      },
    },
  }, async (req, rep) => {
    const u = req.usuario!;
    const { pago_tomado: pagoTomado, efectivo_contado: contado } = req.body;
    const motivo = req.body.motivo_diferencia?.trim() || null;
    const momento = ahora();
    const cierre = await bd.transaccion(async (tx) => {
      const [t] = await tx.consultar<FilaTurno & { responsable_id: string }>(
        `${SELECT_TURNO.replace('SELECT t.id,', 'SELECT t.id, t.responsable_id,')} WHERE t.estado = 'ABIERTO' FOR UPDATE OF t`);
      if (!t) throw new ErrorApi(409, 'SIN_TURNO_ABIERTO', 'No hay un turno abierto para entregar.');
      const porAdministracion = t.responsable_id !== u.id;
      if (porAdministracion && u.rol !== 'ADMINISTRACION') throw new ErrorApi(403, 'SIN_PERMISO', 'Solo quien tiene el turno lo puede entregar.');
      const motivoCierre = req.body.motivo_cierre?.trim() || null;
      // FR-13: la administración no entrega turnos; solo cierra uno trabado, y siempre con el motivo.
      if (porAdministracion && !motivoCierre) {
        throw new ErrorApi(403, 'SIN_PERMISO', 'La administración no entrega turnos. Si quien lo tenía se fue sin entregarlo, ciérrelo escribiendo el motivo.');
      }

      const pago = await pagoDelTurno(tx, t);
      const esperado = (await resumenCaja(tx, t)).debe_haber - (pagoTomado ? pago : 0);
      const diferencia = contado - esperado;
      if (diferencia !== 0 && !motivo) {
        throw new ErrorApi(422, 'MOTIVO_REQUERIDO', 'Lo que contó no coincide con lo que debería haber. Escriba el motivo de la diferencia.');
      }
      await tx.consultar(
        `UPDATE turnos SET estado = 'CERRADO', fin_en = $2, pago_turno = $3, pago_tomado = $4, efectivo_esperado = $5,
                efectivo_contado = $6, motivo_diferencia = $7, cerrado_por_id = $8, motivo_cierre = $9 WHERE id = $1`,
        [t.id, momento, pago, pagoTomado, esperado, contado, diferencia === 0 ? null : motivo,
          porAdministracion ? u.id : null, porAdministracion ? motivoCierre : null]);
      // El siguiente turno (día ↔ noche) queda esperando a quien lo reciba, con lo que se contó.
      const siguiente = t.tipo === 'NOCHE' ? 'DIA' : 'NOCHE';
      const [nuevo] = await tx.consultar<{ id: string }>(
        `INSERT INTO turnos (tipo, estado, recibido_de_id, inicio_en, base_entregada, pago_turno)
         VALUES ($1, 'POR_RECIBIR', $2, $3, $4, $5) RETURNING id`,
        [siguiente, u.id, momento, contado, await regla(tx, siguiente === 'DIA' ? 'pago_turno_dia' : 'pago_turno_noche')]);

      await auditar(tx, {
        usuarioId: u.id, accion: 'ENTREGAR_TURNO', entidad: 'turnos', entidadId: t.id, ocurrido: momento,
        detalle: {
          esperado: String(esperado), contado: String(contado), diferencia: String(diferencia), pago_tomado: pagoTomado ? 'si' : 'no',
          ...(porAdministracion ? { cierre_por_administracion: motivoCierre! } : {}),
        },
      });
      const eventos: Array<[string, Record<string, unknown>]> = [['turno.entregado', { turno_id: t.id, siguiente_id: nuevo.id, entregado_por: u.usuario }]];
      if (diferencia !== 0) {
        eventos.push(['turno.diferencia', { turno_id: t.id, momento: 'ENTREGA', esperado, contado, diferencia, entregado_por: u.usuario }]);
      }
      await publicarEventos(tx, eventos, momento);
      if (!porAdministracion) await cerrarSesion(tx, momento, u);
      return { id: t.id, porAdministracion };
    });
    if (!cierre.porAdministracion) rep.clearCookie(COOKIE, { path: '/' });
    const id = cierre.id;
    const [t] = await bd.consultar<FilaTurno>(`${SELECT_TURNO} WHERE t.id = $1`, [id]);
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
