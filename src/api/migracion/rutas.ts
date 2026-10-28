// Reportes de extranjeros a Migración Colombia (TICKET-37; FR-33, RN-24). Quien aloje a un extranjero debe reportar su
// llegada y su salida por el SIRE (Decreto 1067 de 2015, art. 2.2.1.11.5.1; Resolución 2357 de 2020) [V]. Hoy nadie lo
// hace (HG-ACT-001 V6-02). El sistema no se conecta al SIRE: calcula lo pendiente, entrega los datos para llenarlo
// (consulta auditada) y guarda quién marcó «Ya lo reporté».
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { regla } from '../configuracion/reglas.ts';

export type TipoReporte = 'LLEGADA' | 'SALIDA';
export interface Pendiente { estadia_id: string; habitacion_numero: string; tipo: TipoReporte; desde: string; atrasado: boolean }

/** «Colombia», «colombiana», «COLOMBIANO»: cuentan como Colombia. Sin nacionalidad (anonimizado), no se reporta. */
export function esExtranjero(nacionalidad: string | null): boolean {
  if (!nacionalidad?.trim()) return false;
  const n = nacionalidad.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
  return !/^colombi(a|ano|ana)$/.test(n);
}

interface Fila {
  id: string; habitacion_numero: string; estado: string; entrada_en: Date; salida_real_en: Date | null; nacionalidad: string | null;
  llegada: boolean; salida: boolean;
}

async function candidatas(bd: Bd, estadiaId?: string): Promise<Fila[]> {
  return bd.consultar<Fila>(
    `SELECT e.id, e.habitacion_numero, e.estado, e.entrada_en, e.salida_real_en, h.nacionalidad,
            coalesce(bool_or(r.tipo = 'LLEGADA'), false) AS llegada, coalesce(bool_or(r.tipo = 'SALIDA'), false) AS salida
       FROM estadias e JOIN huespedes h ON h.id = e.huesped_id LEFT JOIN reportes_migracion r ON r.estadia_id = e.id
      WHERE e.estado IN ('ACTIVA', 'CERRADA', 'DESISTIDA') AND ($1::uuid IS NULL OR e.id = $1)
        -- HAL-23: de un huésped anonimizado ya no hay datos que reportar; y lo ya reportado del todo no se revisa.
        AND h.anonimizado_en IS NULL AND h.nacionalidad IS NOT NULL
      GROUP BY e.id, h.nacionalidad
     HAVING NOT (coalesce(bool_or(r.tipo = 'LLEGADA'), false) AND coalesce(bool_or(r.tipo = 'SALIDA'), false))`, [estadiaId ?? null]);
}

/** Lo que falta reportar de una estadía. Si desistió antes de reportar la llegada, no hay nada que reportar. */
function faltantes(f: Fila): Array<{ tipo: TipoReporte; desde: Date }> {
  if (!esExtranjero(f.nacionalidad)) return [];
  const r: Array<{ tipo: TipoReporte; desde: Date }> = [];
  if (!f.llegada && f.estado !== 'DESISTIDA') r.push({ tipo: 'LLEGADA', desde: new Date(f.entrada_en) });
  const salio = f.estado === 'CERRADA' || (f.estado === 'DESISTIDA' && f.llegada);
  if (!f.salida && salio && f.salida_real_en) r.push({ tipo: 'SALIDA', desde: new Date(f.salida_real_en) });
  return r;
}

async function pendientes(bd: Bd, momento: Date, estadiaId?: string): Promise<Pendiente[]> {
  const limite = (await regla(bd, 'horas_reporte_migracion')) * 3_600_000;
  return (await candidatas(bd, estadiaId))
    .flatMap((f) => faltantes(f).map((p) => ({ ...p, f })))
    .sort((a, b) => a.desde.getTime() - b.desde.getTime())
    .map(({ f, tipo, desde }) => ({
      estadia_id: f.id, habitacion_numero: f.habitacion_numero, tipo, desde: aBogota(desde), atrasado: momento.getTime() - desde.getTime() > limite,
    }));
}

const PARAMS_ID = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } };

export function rutasMigracion(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const roles = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);

  // Sin datos del huésped: solo la habitación, el tipo y desde cuándo. La pantalla lo muestra en la campana.
  app.get('/migracion/pendientes', { preHandler: roles }, async () => ({ items: await pendientes(bd, ahora()) }));

  // Los datos para llenar el SIRE. Cada consulta queda en la auditoría, sin los datos (como la lista para la policía).
  app.get<{ Params: { id: string } }>('/migracion/datos/:id', { preHandler: roles, schema: { params: PARAMS_ID } }, async (req) => {
    const [f] = await bd.consultar<{ habitacion_numero: string; nombre: string | null; tipo_documento: string | null; numero_documento: string | null;
      nacionalidad: string | null; entrada_en: Date; salida_real_en: Date | null; salida_prevista_en: Date }>(
      `SELECT e.habitacion_numero, h.nombre, h.tipo_documento, h.numero_documento, h.nacionalidad, e.entrada_en, e.salida_real_en, e.salida_prevista_en
         FROM estadias e JOIN huespedes h ON h.id = e.huesped_id WHERE e.id = $1`, [req.params.id]);
    if (!f) throw new ErrorApi(404, 'NO_ENCONTRADO', 'No existe esa estadía.');
    if (!esExtranjero(f.nacionalidad)) throw new ErrorApi(409, 'CONFLICTO', 'El titular de esta estadía no es extranjero: no se reporta a Migración.');
    const momento = ahora();
    await auditar(bd, { usuarioId: req.usuario!.id, accion: 'CONSULTAR', entidad: 'reporte_migracion', entidadId: req.params.id,
      detalle: { habitacion: f.habitacion_numero }, ocurrido: momento });
    return {
      habitacion_numero: f.habitacion_numero, nombre: f.nombre, tipo_documento: f.tipo_documento, numero_documento: f.numero_documento,
      nacionalidad: f.nacionalidad, entrada_en: aBogota(new Date(f.entrada_en)),
      salida_en: f.salida_real_en ? aBogota(new Date(f.salida_real_en)) : null, salida_prevista_en: aBogota(new Date(f.salida_prevista_en)),
    };
  });

  app.post<{ Body: { estadia_id: string; tipo: TipoReporte } }>('/migracion/reportes', {
    preHandler: roles,
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['estadia_id', 'tipo'],
      properties: { estadia_id: { type: 'string', format: 'uuid' }, tipo: { type: 'string', enum: ['LLEGADA', 'SALIDA'] } },
    } },
  }, async (req, rep) => {
    const u = req.usuario!;
    const { estadia_id, tipo } = req.body;
    const momento = ahora();
    const r = await bd.transaccion(async (tx) => {
      const [est] = await tx.consultar<{ habitacion_numero: string }>('SELECT habitacion_numero FROM estadias WHERE id = $1', [estadia_id]);
      if (!est) throw new ErrorApi(404, 'NO_ENCONTRADO', 'No existe esa estadía.');
      if (!(await pendientes(tx, momento, estadia_id)).some((p) => p.tipo === tipo)) {
        throw new ErrorApi(409, 'CONFLICTO', 'No hay nada pendiente por reportar: ya se reportó, el titular no es extranjero o todavía no ha salido.');
      }
      const [fila] = await tx.consultar<{ id: string }>(
        `INSERT INTO reportes_migracion (estadia_id, tipo, reportado_por, reportado_en) VALUES ($1, $2, $3, $4)
         ON CONFLICT (estadia_id, tipo) DO NOTHING RETURNING id`, [estadia_id, tipo, u.id, momento]);
      if (!fila) throw new ErrorApi(409, 'CONFLICTO', 'Ese reporte ya estaba marcado.');
      await auditar(tx, { usuarioId: u.id, accion: 'CREAR', entidad: 'reporte_migracion', entidadId: fila.id,
        detalle: { habitacion: est.habitacion_numero, tipo }, ocurrido: momento });
      // Las demás pantallas recalculan sus avisos.
      await tx.consultar('INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)',
        ['habitacion.actualizada', JSON.stringify({ numero: est.habitacion_numero, entidad_id: estadia_id }), momento]);
      return { id: fila.id, estadia_id, habitacion_numero: est.habitacion_numero, tipo, reportado_por: u.usuario, reportado_en: aBogota(momento) };
    });
    return rep.code(201).send(r);
  });
}
