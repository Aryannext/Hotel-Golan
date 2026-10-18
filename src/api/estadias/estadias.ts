// Estadías (FR-03, FR-05; RN-02, RN-03, RN-05, RN-06, RN-16): registrar la entrada y consultar la cuenta.
// Todo el registro ocurre en una transacción: huésped, autorización, estadía, cargos, pago, habitación, auditoría y eventos.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota, horaTexto } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { conIdempotencia } from '../comun/idempotencia.ts';
import { diferenciaAjustada, turnoAbiertoId, turnoDeEntrada } from '../caja/turnos.ts';
import { cotizar, type ModalidadCotizable, type TipoHabitacion } from '../reglas/reglas.ts';
import { descuentoPedido, regla, tarifasVigentes } from './cotizaciones.ts';
import { publicarEventos, type Evento } from '../comun/eventos.ts';

const HABITACIONES = ['201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '301'];
const UNICO_VIOLADO = '23505';

/** Solo los 3 últimos caracteres del documento (ADR-006). */
export const enmascarar = (doc: string | null) => (doc ? '••••' + doc.slice(-3) : null);

// ---------- Lectura ----------

interface FilaEstadia {
  id: string; habitacion_numero: string; modalidad: string; personas: number; noches: number; entrada_en: Date;
  salida_prevista_en: Date; salida_real_en: Date | null; estado: string; forma_cobro: string;
  huesped_id: string; nombre: string | null; tipo_documento: string | null; numero_documento: string | null;
  nacionalidad: string | null; anonimizado_en: Date | null; registro_tardio: boolean; registrada_por: string; creada_en: Date;
}

export async function leerEstadia(bd: Bd, id: string) {
  const [f] = await bd.consultar<FilaEstadia>(
    `SELECT e.id, e.habitacion_numero, e.modalidad, e.personas, e.noches, e.entrada_en, e.salida_prevista_en, e.salida_real_en,
            e.estado, e.forma_cobro, h.id AS huesped_id, h.nombre, h.tipo_documento, h.numero_documento, h.nacionalidad, h.anonimizado_en,
            e.registro_tardio, u.usuario AS registrada_por, e.creada_en
       FROM estadias e JOIN huespedes h ON h.id = e.huesped_id JOIN usuarios u ON u.id = e.creada_por WHERE e.id = $1`, [id]);
  if (!f) return null;
  const cargos = await bd.consultar<{ id: string; tipo: string; concepto: string; cantidad: number; valor_unitario: number; valor: number; creado_por: string; creado_en: Date; anulado: boolean }>(
    `SELECT c.id, c.tipo, c.concepto, c.cantidad, c.valor_unitario, c.valor, u.usuario AS creado_por, c.creado_en, c.anulado_en IS NOT NULL AS anulado
       FROM cargos c JOIN usuarios u ON u.id = c.creado_por WHERE c.estadia_id = $1 ORDER BY c.creado_en, (c.tipo = 'DESCUENTO')`, [id]);
  const pagos = await bd.consultar<{ id: string; turno_id: string; medio: string; valor: number; estado: string; registrado_por: string; registrado_en: Date; verificado_por: string | null; verificado_en: Date | null; anulado: boolean }>(
    `SELECT p.id, p.turno_id, p.medio, p.valor, p.estado, r.usuario AS registrado_por, p.registrado_en,
            v.usuario AS verificado_por, p.verificado_en, p.anulado_en IS NOT NULL AS anulado
       FROM pagos p JOIN usuarios r ON r.id = p.registrado_por LEFT JOIN usuarios v ON v.id = p.verificado_por
      WHERE p.estadia_id = $1 ORDER BY p.registrado_en`, [id]);

  // TICKET-26: lo devuelto en efectivo por un cambio de habitación, y la ropa de lavandería sin entregar (aviso al salir).
  const [extra] = await bd.consultar<{ devuelto: number; lavanderia: number }>(
    `SELECT coalesce((SELECT sum(valor) FROM movimientos_caja WHERE estadia_id = $1 AND anulado_en IS NULL), 0)::int AS devuelto,
            (SELECT count(*) FROM pedidos_lavanderia WHERE estadia_id = $1 AND estado = 'RECIBIDO')::int AS lavanderia`, [id]);
  const vigentes = (x: { anulado: boolean }) => !x.anulado;
  const suma = (xs: Array<{ valor: number }>) => xs.reduce((s, x) => s + x.valor, 0);
  const totalCargos = suma(cargos.filter(vigentes));
  const pagado = suma(pagos.filter((p) => vigentes(p) && (p.estado === 'EN_CAJA' || p.estado === 'VERIFICADO'))) - extra.devuelto;
  const porVerificar = suma(pagos.filter((p) => vigentes(p) && p.estado === 'POR_VERIFICAR'));
  const anonimizado = !!f.anonimizado_en;

  return {
    id: f.id, habitacion_numero: f.habitacion_numero,
    huesped: {
      id: f.huesped_id, nombre_mostrado: anonimizado || !f.nombre ? 'Huésped anonimizado' : f.nombre,
      tipo_documento: f.tipo_documento, documento_enmascarado: enmascarar(f.numero_documento), nacionalidad: f.nacionalidad, anonimizado,
    },
    modalidad: f.modalidad, personas: f.personas, noches: f.noches,
    entrada_en: aBogota(new Date(f.entrada_en)), salida_prevista_en: aBogota(new Date(f.salida_prevista_en)),
    salida_real_en: f.salida_real_en ? aBogota(new Date(f.salida_real_en)) : null,
    estado: f.estado, forma_cobro: f.forma_cobro,
    // ADR-010: quién digitó la entrada y cuándo; en un registro tardío difiere de la hora real de entrada.
    registro_tardio: f.registro_tardio, registrada_por: f.registrada_por, registrada_en: aBogota(new Date(f.creada_en)),
    cargos: cargos.map((c) => ({ ...c, creado_en: aBogota(new Date(c.creado_en)) })),
    pagos: pagos.map((p) => ({
      id: p.id, estadia_id: f.id, habitacion_numero: f.habitacion_numero, turno_id: p.turno_id, medio: p.medio, valor: p.valor,
      estado: p.estado, registrado_por: p.registrado_por, registrado_en: aBogota(new Date(p.registrado_en)),
      verificado_por: p.verificado_por, verificado_en: p.verificado_en ? aBogota(new Date(p.verificado_en)) : null, anulado: p.anulado,
    })),
    lavanderia_por_entregar: extra.lavanderia,
    cuenta: {
      total_cargos: totalCargos, pagado, por_verificar: porVerificar, devuelto: extra.devuelto,
      saldo: Math.max(0, totalCargos - pagado - porVerificar), a_favor: Math.max(0, pagado + porVerificar - totalCargos),
    },
  };
}

// ---------- Registro de la entrada ----------

interface Cuerpo {
  habitacion_numero: string; modalidad: ModalidadCotizable; personas: number; noches?: number; aplicar_descuento?: boolean; valor_descuento?: number;
  registro_tardio?: boolean; entrada_en?: string;
  huesped: { nombre: string; tipo_documento?: string; numero_documento?: string; nacionalidad: string; telefono?: string; es_menor: boolean; acompanante_verificado?: boolean };
  autorizacion: { otorgada: boolean; version_aviso: string };
  pago: { forma: 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA' | 'AL_SALIR'; valor_recibido?: number };
}

const esquemaCuerpo = {
  type: 'object', additionalProperties: false, required: ['habitacion_numero', 'modalidad', 'personas', 'huesped', 'autorizacion', 'pago'],
  properties: {
    habitacion_numero: { type: 'string', enum: HABITACIONES },
    modalidad: { type: 'string', enum: ['NOCHE', 'TRES_HORAS'] },
    personas: { type: 'integer', minimum: 1, maximum: 3 },
    noches: { type: 'integer', minimum: 1, maximum: 30, default: 1 },
    aplicar_descuento: { type: 'boolean', default: false },
    valor_descuento: { type: 'integer', minimum: 0 },
    registro_tardio: { type: 'boolean', default: false },
    entrada_en: { type: 'string', format: 'date-time' },
    huesped: {
      type: 'object', additionalProperties: false, required: ['nombre', 'nacionalidad', 'es_menor'],
      properties: {
        nombre: { type: 'string', minLength: 3, maxLength: 120 },
        tipo_documento: { type: 'string', enum: ['CC', 'CE', 'TI', 'RC', 'PASAPORTE', 'PPT'] },
        numero_documento: { type: 'string', pattern: '^[A-Za-z0-9-]{4,20}$' },
        nacionalidad: { type: 'string', minLength: 2, maxLength: 60 },
        telefono: { type: 'string', pattern: String.raw`^\+57[0-9]{10}$` },
        es_menor: { type: 'boolean' },
        acompanante_verificado: { type: 'boolean' },
      },
      // Un número de documento necesita su tipo.
      dependencies: { numero_documento: ['tipo_documento'] },
      // RN-16: un menor solo entra con acompañante verificado.
      if: { properties: { es_menor: { const: true } } },
      then: { required: ['acompanante_verificado'], properties: { acompanante_verificado: { const: true } } },
    },
    autorizacion: {
      type: 'object', additionalProperties: false, required: ['otorgada', 'version_aviso'],
      properties: { otorgada: { type: 'boolean' }, version_aviso: { type: 'string', pattern: '^AV-[0-9]{4}-[0-9]{2}$' } },
    },
    pago: {
      type: 'object', additionalProperties: false, required: ['forma'],
      properties: {
        forma: { type: 'string', enum: ['EFECTIVO', 'NEQUI', 'BANCOLOMBIA', 'AL_SALIR'] },
        valor_recibido: { type: 'integer', minimum: 0, maximum: 100000000 },
      },
    },
  },
} as const;

export function conceptoAlojamiento(modalidad: ModalidadCotizable, tipo: TipoHabitacion, personas: number, noches: number) {
  const hab = tipo === 'AIRE' ? 'aire' : 'ventilador';
  if (modalidad === 'TRES_HORAS') return `Tres horas · ${hab}`;
  const cuantas = noches === 1 ? 'Noche' : `${noches} noches`;
  return `${cuantas} · ${hab}, ${personas} ${personas === 1 ? 'persona' : 'personas'}`;
}

/** Titular y su autorización de datos (FR-05, ADR-006). */
async function crearHuesped(tx: Bd, b: Cuerpo, usuarioId: string, entrada: Date): Promise<string> {
  const hu = b.huesped;
  const [huesped] = await tx.consultar<{ id: string }>(
    `INSERT INTO huespedes (nombre, tipo_documento, numero_documento, nacionalidad, telefono, es_menor, acompanante_verificado)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [hu.nombre.trim(), hu.tipo_documento ?? null, hu.numero_documento ?? null, hu.nacionalidad.trim(), hu.telefono ?? null, hu.es_menor, hu.acompanante_verificado ?? false]);
  await tx.consultar('INSERT INTO autorizaciones_datos (huesped_id, version_aviso, otorgada_en, registrada_por) VALUES ($1, $2, $3, $4)',
    [huesped.id, b.autorizacion.version_aviso, entrada, usuarioId]);
  return huesped.id;
}

/** Inserta la estadía; si la habitación ya tiene una activa (índice único), responde 409. */
async function crearEstadia(tx: Bd, valores: unknown[]): Promise<string> {
  try {
    const [{ id }] = await tx.consultar<{ id: string }>(
      `INSERT INTO estadias (habitacion_numero, huesped_id, turno_id, modalidad, personas, noches, entrada_en, salida_prevista_en,
                             forma_cobro, creada_por, creada_en, registro_tardio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`, valores);
    return id;
  } catch (error) {
    if ((error as { code?: string }).code === UNICO_VIOLADO) {
      throw new ErrorApi(409, 'HABITACION_NO_DISPONIBLE', `La habitación ${String(valores[0])} ya tiene una estadía activa.`);
    }
    throw error;
  }
}

/**
 * Pago al entrar. Efectivo: si recibió más, la diferencia son vueltas; si recibió menos, queda como abono.
 * Transferencia: queda por verificar (RN-12) y devuelve el evento para avisar a la administración.
 */
async function cobrarAlEntrar(tx: Bd, b: Cuerpo, e: { estadiaId: string; turnoId: string; total: number; usuarioId: string; momento: Date }): Promise<Evento | null> {
  const efectivo = b.pago.forma === 'EFECTIVO';
  const valor = efectivo ? Math.min(b.pago.valor_recibido ?? e.total, e.total) : e.total;
  if (valor <= 0) return null;
  const [p] = await tx.consultar<{ id: string }>(
    `INSERT INTO pagos (estadia_id, turno_id, medio, valor, estado, registrado_por, registrado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [e.estadiaId, e.turnoId, b.pago.forma, valor, efectivo ? 'EN_CAJA' : 'POR_VERIFICAR', e.usuarioId, e.momento]);
  return efectivo ? null : ['pago.por_verificar', { entidad_id: p.id, habitacion_numero: b.habitacion_numero, valor }];
}

/** `momento` es cuándo se digita; `entrada` es la hora real (igual a `momento` salvo en un registro tardío, ADR-010). */
async function registrarEntrada(tx: Bd, b: Cuerpo, usuario: { id: string; usuario: string }, momento: Date, entrada: Date) {
  const turnoAbierto = await turnoAbiertoId(tx);
  // ADR-010 (V5-16): en un registro tardío, la estadía y su pago son del turno en que entró el huésped, aunque ya se entregó.
  const delTalonario = b.registro_tardio ? await turnoDeEntrada(tx, entrada) : null;
  const turnoId = delTalonario?.id ?? turnoAbierto;
  if (!b.autorizacion.otorgada) {
    throw new ErrorApi(422, 'AUTORIZACION_REQUERIDA', 'Sin la autorización del huésped para el tratamiento de sus datos no se puede registrar la entrada.');
  }

  // Bloqueo de fila: si dos personas eligen la misma habitación, la segunda espera y la encuentra ocupada.
  const [h] = await tx.consultar<{ tipo: TipoHabitacion; estado: string }>(
    'SELECT tipo, estado FROM habitaciones WHERE numero = $1 FOR UPDATE', [b.habitacion_numero]);
  if (h.estado !== 'DISPONIBLE') {
    throw new ErrorApi(409, 'HABITACION_NO_DISPONIBLE', `La habitación ${b.habitacion_numero} no está disponible.`);
  }

  // El precio y la salida se recalculan aquí; no se confía en lo que muestre el cliente.
  const noches = b.modalidad === 'NOCHE' ? b.noches ?? 1 : 1;
  const maximo = await regla(tx, 'descuento_noche');
  const c = cotizar({
    tarifas: await tarifasVigentes(tx, entrada), descuentoNoche: maximo, tipo: h.tipo,
    modalidad: b.modalidad, personas: b.personas, noches, descuentoPorNoche: descuentoPedido(b, maximo), entrada,
  });
  const alSalir = b.pago.forma === 'AL_SALIR';
  if (alSalir && !c.permitePagoAlSalir) {
    throw new ErrorApi(422, 'PAGO_AL_SALIR_NO_PERMITIDO', 'Solo una noche se puede pagar al salir. Varias noches o tres horas se cobran por adelantado.');
  }

  const huespedId = await crearHuesped(tx, b, usuario.id, entrada);
  const estadiaId = await crearEstadia(tx, [b.habitacion_numero, huespedId, turnoId, b.modalidad, b.personas, noches, entrada, c.salida,
    alSalir ? 'AL_SALIR' : 'ANTICIPADO', usuario.id, momento, b.registro_tardio ?? false]);

  const cargo = (tipo: string, concepto: string, cantidad: number, unitario: number) => tx.consultar(
    `INSERT INTO cargos (estadia_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [estadiaId, tipo, concepto, cantidad, unitario, unitario * cantidad, usuario.id, momento]);
  await cargo('ALOJAMIENTO', conceptoAlojamiento(b.modalidad, h.tipo, b.personas, noches), noches, c.tarifa / noches);
  // RN-05: el descuento queda aparte, con quién lo dio.
  if (c.descuento > 0) await cargo('DESCUENTO', 'Descuento por noche (lo pidió el cliente)', noches, -c.descuento / noches);

  const eventoPago = alSalir ? null : await cobrarAlEntrar(tx, b, { estadiaId, turnoId, total: c.total, usuarioId: usuario.id, momento });
  // En un turno ya entregado, su diferencia cambia: se avisa a la administración con la diferencia ajustada.
  const eventoTurno: Evento | null = delTalonario?.cerrado && !alSalir ? ['turno.diferencia', {
    turno_id: turnoId, momento: 'REGISTRO_TARDIO', valor: c.total, habitacion_numero: b.habitacion_numero,
    registrado_por: usuario.usuario, diferencia_ajustada: await diferenciaAjustada(tx, turnoId),
  }] : null;

  await tx.consultar('UPDATE habitaciones SET estado = $2, actualizado_en = $3 WHERE numero = $1', [b.habitacion_numero, 'OCUPADA', momento]);
  // Auditoría sin datos personales (FR-20, ADR-006).
  await auditar(tx, {
    usuarioId: usuario.id, accion: 'CREAR', entidad: 'estadias', entidadId: estadiaId,
    detalle: {
      habitacion: b.habitacion_numero, modalidad: b.modalidad, total: String(c.total), pago: b.pago.forma,
      ...(b.registro_tardio ? { registro_tardio: 'si' } : {}), ...(turnoId === turnoAbierto ? {} : { turno: 'de la entrada real' }),
    },
    ocurrido: momento,
  });
  await publicarEventos(tx, [
    ...(eventoPago ? [eventoPago] : []),
    ...(eventoTurno ? [eventoTurno] : []),
    ['estadia.creada', { entidad_id: estadiaId, habitacion_numero: b.habitacion_numero }],
    ['habitacion.actualizada', { numero: b.habitacion_numero, estado: 'OCUPADA' }],
  ], momento);
  return estadiaId;
}

const LIMITE_TARDIO_MS = 48 * 3_600_000;

/** ADR-010: `entrada_en` solo va con `registro_tardio`, y debe estar en las últimas 48 horas (no en el futuro). */
function horaDeEntrada(b: Cuerpo, momento: Date): Date {
  if (!b.registro_tardio && !b.entrada_en) return momento;
  if (!b.registro_tardio) throw new ErrorApi(400, 'INVALID_PAYLOAD', 'La hora de entrada solo se escribe en un registro tardío (lo anotado en el talonario).');
  if (!b.entrada_en) throw new ErrorApi(400, 'INVALID_PAYLOAD', 'En un registro tardío escriba la hora real en que entró el huésped.');
  const entrada = new Date(b.entrada_en);
  if (entrada.getTime() > momento.getTime()) throw new ErrorApi(400, 'INVALID_PAYLOAD', 'La hora de entrada no puede ser posterior a la hora actual.');
  if (momento.getTime() - entrada.getTime() > LIMITE_TARDIO_MS) {
    throw new ErrorApi(400, 'INVALID_PAYLOAD', 'El registro tardío solo acepta entradas de las últimas 48 horas. Avise a la administración.');
  }
  return entrada;
}

export function rutasEstadias(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const sesion = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);

  app.post<{ Body: Cuerpo; Headers: { 'idempotency-key'?: string } }>('/estadias', {
    preHandler: sesion,
    schema: {
      body: esquemaCuerpo,
      headers: { type: 'object', properties: { 'idempotency-key': { type: 'string', format: 'uuid' } } },
    },
  }, async (req, rep) => {
    const b = req.body;
    const momento = ahora();
    const entrada = horaDeEntrada(b, momento);
    if (b.pago.valor_recibido !== undefined && b.pago.forma !== 'EFECTIVO') {
      throw new ErrorApi(400, 'INVALID_PAYLOAD', 'El valor recibido solo aplica a pagos en efectivo.');
    }
    const u = req.usuario!;
    const r = await conIdempotencia(bd, req.headers['idempotency-key'], u.id, 'crearEstadia', async (tx) => {
      const id = await registrarEntrada(tx, b, u, momento, entrada);
      return { estado: 201, cuerpo: await leerEstadia(tx, id) };
    });
    return rep.code(r.estado).send(r.cuerpo);
  });

  app.get<{ Querystring: { estado?: string; limite: number; desplazamiento: number } }>('/estadias', {
    preHandler: sesion,
    schema: {
      querystring: {
        type: 'object', additionalProperties: false,
        properties: {
          estado: { type: 'string', enum: ['ACTIVA', 'CERRADA', 'DESISTIDA'] },
          limite: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          desplazamiento: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (req) => {
    const { estado = null, limite, desplazamiento } = req.query;
    const [{ total }] = await bd.consultar<{ total: number }>(
      'SELECT count(*)::int AS total FROM estadias WHERE ($1::text IS NULL OR estado = $1)', [estado]);
    const ids = await bd.consultar<{ id: string }>(
      `SELECT id FROM estadias WHERE ($1::text IS NULL OR estado = $1) ORDER BY entrada_en DESC, id LIMIT $2 OFFSET $3`,
      [estado, limite, desplazamiento]);
    // Fuera de transacción: las lecturas pueden ir en paralelo (el pool reparte las conexiones).
    const items = await Promise.all(ids.map(({ id }) => leerEstadia(bd, id)));
    return { items, total };
  });

  // Dar salida (FR-09; RN-07): solo con la cuenta en $0. La habitación pasa a «Por revisar» (FR-02).
  // Una transferencia por verificar cuenta como pagada: la habitación se entrega igual (RN-12).
  app.post<{ Params: { id: string } }>('/estadias/:id/salida', {
    preHandler: sesion,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } },
  }, async (req) => {
    const u = req.usuario!;
    const momento = ahora();
    return bd.transaccion(async (tx) => {
      const [f] = await tx.consultar<{ estado: string; habitacion_numero: string }>(
        'SELECT estado, habitacion_numero FROM estadias WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!f) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La estadía no existe.');
      if (f.estado !== 'ACTIVA') throw new ErrorApi(409, 'CONFLICTO', 'Esta estadía ya terminó.');
      const { cuenta } = (await leerEstadia(tx, req.params.id))!;
      if (cuenta.saldo > 0) {
        throw new ErrorApi(409, 'SALDO_PENDIENTE', `Nadie sale debiendo: falta cobrar $${cuenta.saldo.toLocaleString('es-CO')}.`);
      }
      await tx.consultar(`UPDATE estadias SET estado = 'CERRADA', salida_real_en = $2 WHERE id = $1`, [req.params.id, momento]);
      await tx.consultar(`UPDATE habitaciones SET estado = 'POR_REVISAR', nota = $2, actualizado_en = $3 WHERE numero = $1`,
        [f.habitacion_numero, `Salió a las ${horaTexto(momento)}`, momento]);
      await auditar(tx, { usuarioId: u.id, accion: 'ACTUALIZAR', entidad: 'estadias', entidadId: req.params.id, detalle: { accion: 'SALIDA' }, ocurrido: momento });
      await publicarEventos(tx, [
        ['estadia.cerrada', { entidad_id: req.params.id, habitacion_numero: f.habitacion_numero }],
        ['habitacion.actualizada', { numero: f.habitacion_numero, estado: 'POR_REVISAR' }],
      ], momento);
      return leerEstadia(tx, req.params.id);
    });
  });

  app.get<{ Params: { id: string } }>('/estadias/:id', {
    preHandler: sesion,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } } },
  }, async (req) => {
    const est = await leerEstadia(bd, req.params.id);
    if (!est) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La estadía no existe.');
    return est;
  });
}
