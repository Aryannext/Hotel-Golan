// Extender la estadía (FR-08; RN-04): otra noche, tres horas o por horas, con la regla de las 4:00 p. m.
// La cotización (sin guardar nada) usa la misma regla, para que la pantalla muestre exactamente lo que se cobrará.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { conIdempotencia } from '../comun/idempotencia.ts';
import { calcularExtension, type ModalidadExtension, type TipoHabitacion } from '../reglas/reglas.ts';
import { regla, tarifasVigentes } from './cotizaciones.ts';
import { estadiaActiva } from './cargos.ts';
import { leerEstadia } from './estadias.ts';

interface Cuerpo { modalidad: ModalidadExtension; horas?: number }

const esquema = {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: {
    type: 'object', additionalProperties: false, required: ['modalidad'],
    properties: {
      modalidad: { type: 'string', enum: ['NOCHE', 'TRES_HORAS', 'POR_HORAS'] },
      horas: { type: 'integer', minimum: 1, maximum: 12 },
    },
    // Las horas se piden solo con POR_HORAS (y ahí son obligatorias).
    if: { properties: { modalidad: { const: 'POR_HORAS' } } },
    then: { required: ['horas'] },
    else: { not: { required: ['horas'] } },
  },
};

async function calcular(tx: Bd, id: string, b: Cuerpo, ahora: Date) {
  const est = await estadiaActiva(tx, id);
  const [f] = await tx.consultar<{ tipo: TipoHabitacion; personas: number; salida_prevista_en: Date }>(
    `SELECT h.tipo, e.personas, e.salida_prevista_en FROM estadias e JOIN habitaciones h ON h.numero = e.habitacion_numero WHERE e.id = $1`, [id]);
  const r = calcularExtension({
    tarifas: await tarifasVigentes(tx, ahora), tipo: f.tipo, personas: f.personas,
    valorHora: await regla(tx, 'valor_hora'), horaNocheCompleta: await regla(tx, 'hora_noche_completa'),
    modalidad: b.modalidad, horas: b.horas, salidaActual: new Date(f.salida_prevista_en), ahora,
  });
  return { habitacion: est.habitacion_numero, ...r };
}

/** Concepto, cantidad y valor unitario del cargo de una extensión. */
function renglonExtension(r: ReturnType<typeof calcularExtension>): [string, number, number] {
  if (r.modalidadCobrada === 'POR_HORAS') return [`Extensión: ${r.horas} ${r.horas === 1 ? 'hora' : 'horas'}`, r.horas, r.valor / r.horas];
  if (r.pasaDeLas4) return ['Extensión: pasa de las 4:00 p. m., noche completa', 1, r.valor];
  if (r.modalidadCobrada === 'NOCHE') return ['Extensión: otra noche', 1, r.valor];
  return ['Extensión: tres horas', 1, r.valor];
}

export function rutasExtensiones(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const sesion = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);

  app.post<{ Params: { id: string }; Body: Cuerpo }>('/estadias/:id/extensiones/cotizacion', { preHandler: sesion, schema: esquema }, async (req) => {
    const r = await calcular(bd, req.params.id, req.body, ahora());
    return { modalidad_cobrada: r.modalidadCobrada, valor: r.valor, salida_prevista_en: aBogota(r.salida), pasa_de_las_4: r.pasaDeLas4 };
  });

  app.post<{ Params: { id: string }; Body: Cuerpo; Headers: { 'idempotency-key'?: string } }>('/estadias/:id/extensiones', {
    preHandler: sesion,
    schema: { ...esquema, headers: { type: 'object', properties: { 'idempotency-key': { type: 'string', format: 'uuid' } } } },
  }, async (req, rep) => {
    const u = req.usuario!;
    const id = req.params.id;
    const res = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'extenderEstadia', async (tx) => {
      const momento = ahora();
      const r = await calcular(tx, id, req.body, momento);
      // Por horas: cantidad × $8.000. Si pasa de las 4:00 p. m., una sola noche reemplaza las horas (RN-04).
      const [concepto, cantidad, unitario] = renglonExtension(r);
      await tx.consultar(
        `INSERT INTO cargos (estadia_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en)
         VALUES ($1, 'EXTENSION', $2, $3, $4, $5, $6, $7)`, [id, concepto, cantidad, unitario, r.valor, u.id, momento]);
      await tx.consultar('UPDATE estadias SET salida_prevista_en = $2 WHERE id = $1', [id, r.salida]);
      await auditar(tx, {
        usuarioId: u.id, accion: 'ACTUALIZAR', entidad: 'estadias', entidadId: id, ocurrido: momento,
        detalle: { accion: 'EXTENSION', cobrada: r.modalidadCobrada, valor: String(r.valor) },
      });
      await tx.consultar('INSERT INTO eventos_salida (tipo, payload, ocurrido_en) VALUES ($1, $2, $3)',
        ['habitacion.actualizada', JSON.stringify({ numero: r.habitacion, entidad_id: id }), momento]);
      return { estado: 201, cuerpo: await leerEstadia(tx, id) };
    });
    return rep.code(res.estado).send(res.cuerpo);
  });
}
