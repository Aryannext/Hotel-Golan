// Cambio de habitación (TICKET-26; FR-30, RN-17). Reglas de la administradora (HG-ACT-001 V5-03 a V5-05):
// - a los pocos minutos de entrar (`minutos_cambio_sin_cargo`, 5 [P/V]) se cambia a cualquier hora y se ajusta la
//   diferencia: el alojamiento anterior se anula con motivo y se carga el de la nueva; si queda a favor, se devuelve
//   en efectivo con una salida de caja ligada a la estadía;
// - si ya la usó, solo antes de las 12 m., y se cobra la habitación nueva completa (una noche desde ahora) [P];
// - después de las 12 m., no se cambia.
// La habitación que deja pasa a «Por revisar» (FR-02). La cotización usa la misma regla sin guardar nada.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { HABITACIONES } from '../comun/hotel.ts';
import { CABECERA_IDEMPOTENCIA, conIdempotencia, type ConClave } from '../comun/idempotencia.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota, horaTexto } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { publicarEventos, type Evento } from '../comun/eventos.ts';
import { turnoAbiertoId } from '../caja/turnos.ts';
import { calcularSalida, calcularTarifa, type ModalidadCotizable, type TipoHabitacion } from '../reglas/reglas.ts';
import { tarifasVigentes } from './cotizaciones.ts';
import { regla } from '../configuracion/reglas.ts';
import { conceptoAlojamiento, leerEstadia } from './estadias.ts';

type Tipo = 'SIN_USO' | 'NOCHE_NUEVA';
interface Origen {
  id: string; estado: string; habitacion_numero: string; tipo: TipoHabitacion; modalidad: ModalidadCotizable;
  personas: number; noches: number; entrada_en: Date; salida_prevista_en: Date;
}
interface Plan {
  tipo: Tipo; origen: Origen; destino: { numero: string; tipo: TipoHabitacion };
  diferencia: number; nuevoAlojamiento: number; salida: Date; devolucion: number; aFavorPendiente: number;
}

const ESQUEMA = {
  params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
  body: {
    type: 'object', additionalProperties: false, required: ['habitacion_numero'],
    properties: { habitacion_numero: { type: 'string', enum: HABITACIONES } },
  },
};

const minutosDelDia = (d: Date) => { const [h, m] = aBogota(d).slice(11, 16).split(':').map(Number); return h * 60 + m; };

async function planear(tx: Bd, id: string, numeroDestino: string, ahora: Date): Promise<Plan> {
  const [o] = await tx.consultar<Origen>(
    `SELECT e.id, e.estado, e.habitacion_numero, h.tipo, e.modalidad, e.personas, e.noches, e.entrada_en, e.salida_prevista_en
       FROM estadias e JOIN habitaciones h ON h.numero = e.habitacion_numero WHERE e.id = $1 FOR UPDATE OF e`, [id]);
  if (!o) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La estadía no existe.');
  if (o.estado !== 'ACTIVA') throw new ErrorApi(409, 'CONFLICTO', 'La estadía ya terminó.');
  if (numeroDestino === o.habitacion_numero) throw new ErrorApi(409, 'CONFLICTO', `El huésped ya está en la ${numeroDestino}.`);
  const [d] = await tx.consultar<{ tipo: TipoHabitacion; estado: string }>('SELECT tipo, estado FROM habitaciones WHERE numero = $1 FOR UPDATE', [numeroDestino]);
  if (!d) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Esa habitación no existe.');
  if (d.estado !== 'DISPONIBLE') throw new ErrorApi(409, 'HABITACION_NO_DISPONIBLE', `La habitación ${numeroDestino} no está disponible.`);

  const entrada = new Date(o.entrada_en);
  const destino = { numero: numeroDestino, tipo: d.tipo };
  const minutos = (ahora.getTime() - entrada.getTime()) / 60_000;
  if (minutos <= await regla(tx, 'minutos_cambio_sin_cargo')) {
    // Sin uso: el mismo alojamiento al precio de la nueva habitación, con las tarifas de la hora de entrada.
    const tarifas = await tarifasVigentes(tx, entrada);
    const [actual] = await tx.consultar<{ valor: number }>(
      `SELECT coalesce(sum(valor), 0)::int AS valor FROM cargos WHERE estadia_id = $1 AND tipo = 'ALOJAMIENTO' AND anulado_en IS NULL`, [id]);
    const nuevo = calcularTarifa(tarifas, d.tipo, o.modalidad, o.personas, o.noches);
    const diferencia = nuevo - actual.valor;
    const { devolucion, aFavorPendiente } = await devolucionPosible(tx, id, diferencia);
    return { tipo: 'SIN_USO', origen: o, destino, diferencia, nuevoAlojamiento: nuevo, salida: new Date(o.salida_prevista_en), devolucion, aFavorPendiente };
  }
  if (o.modalidad !== 'NOCHE') {
    throw new ErrorApi(409, 'CONFLICTO', 'Una estadía de tres horas solo se cambia a los pocos minutos de haber entrado.');
  }
  if (minutosDelDia(ahora) >= 12 * 60) {
    throw new ErrorApi(409, 'CONFLICTO', 'Después de las 12 m. no se hace cambio de habitación (solo si cambia de opinión a los pocos minutos de entrar).');
  }
  // Ya la usó: la habitación nueva completa, como una noche que entra ahora (V5-04).
  const noche = calcularTarifa(await tarifasVigentes(tx, ahora), d.tipo, 'NOCHE', o.personas, 1);
  return {
    tipo: 'NOCHE_NUEVA', origen: o, destino, diferencia: noche, nuevoAlojamiento: noche,
    salida: calcularSalida('NOCHE', ahora, 1).salida, devolucion: 0, aFavorPendiente: 0,
  };
}

/** Si la cuenta queda a favor, se devuelve en efectivo hasta lo que pagó en efectivo; el resto lo decide la administración. */
async function devolucionPosible(tx: Bd, id: string, diferencia: number) {
  if (diferencia >= 0) return { devolucion: 0, aFavorPendiente: 0 };
  const { cuenta } = (await leerEstadia(tx, id))!;
  const aFavor = Math.max(0, cuenta.pagado + cuenta.por_verificar - (cuenta.total_cargos + diferencia));
  const [p] = await tx.consultar<{ efectivo: number }>(
    `SELECT coalesce(sum(valor), 0)::int AS efectivo FROM pagos WHERE estadia_id = $1 AND anulado_en IS NULL AND estado = 'EN_CAJA'`, [id]);
  const devolucion = Math.min(aFavor, Math.max(0, p.efectivo - cuenta.devuelto));
  return { devolucion, aFavorPendiente: aFavor - devolucion };
}

const respuestaCotizacion = (p: Plan) => ({
  tipo: p.tipo, habitacion_numero: p.destino.numero, diferencia: p.diferencia, devolucion: p.devolucion,
  a_favor_pendiente: p.aFavorPendiente, salida_prevista_en: aBogota(p.salida),
});

async function aplicar(tx: Bd, p: Plan, u: { id: string; usuario: string }, momento: Date): Promise<Evento[]> {
  const { origen: o, destino } = p;
  const deA = `cambio de la ${o.habitacion_numero} a la ${destino.numero}`;
  if (p.tipo === 'SIN_USO') {
    await tx.consultar(
      `UPDATE cargos SET anulado_en = $2, anulado_por = $3, motivo_anulacion = $4 WHERE estadia_id = $1 AND tipo = 'ALOJAMIENTO' AND anulado_en IS NULL`,
      [o.id, momento, u.id, `Cambio de habitación a la ${destino.numero} a los pocos minutos de entrar`]);
  }
  const concepto = p.tipo === 'SIN_USO'
    ? `${conceptoAlojamiento(o.modalidad, destino.tipo, o.personas, o.noches)} (${deA})`
    : `Noche · ${destino.tipo === 'AIRE' ? 'aire' : 'ventilador'} (${deA}; ya había usado la anterior)`;
  const cantidad = p.tipo === 'SIN_USO' && o.modalidad === 'NOCHE' ? o.noches : 1;
  await tx.consultar(
    `INSERT INTO cargos (estadia_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en) VALUES ($1, 'ALOJAMIENTO', $2, $3, $4, $5, $6, $7)`,
    [o.id, concepto, cantidad, p.nuevoAlojamiento / cantidad, p.nuevoAlojamiento, u.id, momento]);
  await tx.consultar('UPDATE estadias SET habitacion_numero = $2, salida_prevista_en = $3 WHERE id = $1', [o.id, destino.numero, p.salida]);
  await tx.consultar(`UPDATE habitaciones SET estado = 'OCUPADA', nota = NULL, actualizado_en = $2 WHERE numero = $1`, [destino.numero, momento]);
  await tx.consultar(`UPDATE habitaciones SET estado = 'POR_REVISAR', nota = $2, actualizado_en = $3 WHERE numero = $1`,
    [o.habitacion_numero, `Se cambió a la ${destino.numero} a las ${horaTexto(momento)}`, momento]);

  const eventos: Evento[] = [
    ['habitacion.actualizada', { numero: o.habitacion_numero, estado: 'POR_REVISAR' }],
    ['habitacion.actualizada', { numero: destino.numero, estado: 'OCUPADA', entidad_id: o.id }],
  ];
  if (p.devolucion > 0) {
    const [m] = await tx.consultar<{ id: string }>(
      `INSERT INTO movimientos_caja (turno_id, tipo, detalle, valor, habitacion_numero, estadia_id, registrado_por, registrado_en)
       VALUES ($1, 'DEVOLUCION', $2, $3, $4, $5, $6, $7) RETURNING id`,
      [await turnoAbiertoId(tx), `Diferencia devuelta por ${deA}`, p.devolucion, destino.numero, o.id, u.id, momento]);
    eventos.push(['caja.movimiento', { entidad_id: m.id, valor: p.devolucion, habitacion_numero: destino.numero }]);
  }
  await auditar(tx, {
    usuarioId: u.id, accion: 'ACTUALIZAR', entidad: 'estadias', entidadId: o.id, ocurrido: momento,
    detalle: { accion: 'CAMBIO_HABITACION', de: o.habitacion_numero, a: destino.numero, tipo: p.tipo, valor: String(p.diferencia), devolucion: String(p.devolucion) },
  });
  return eventos;
}

export function rutasCambioHabitacion(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const turno = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);

  app.post<{ Params: { id: string }; Body: { habitacion_numero: string } }>('/estadias/:id/cambio-habitacion/cotizacion', {
    preHandler: turno, schema: ESQUEMA,
  }, async (req) => bd.transaccion(async (tx) => respuestaCotizacion(await planear(tx, req.params.id, req.body.habitacion_numero, ahora()))));

  app.post<{ Params: { id: string }; Body: { habitacion_numero: string }; Headers: ConClave }>('/estadias/:id/cambio-habitacion', {
    preHandler: turno, schema: { ...ESQUEMA, headers: CABECERA_IDEMPOTENCIA },
  }, async (req, rep) => {
    const u = req.usuario!;
    const r = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'cambiarHabitacion', async (tx) => {
      const momento = ahora();
      await turnoAbiertoId(tx);
      const plan = await planear(tx, req.params.id, req.body.habitacion_numero, momento);
      await publicarEventos(tx, await aplicar(tx, plan, u, momento), momento);
      return { estado: 200, cuerpo: await leerEstadia(tx, req.params.id) };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });
}
