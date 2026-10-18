// Solicitudes de factura (TICKET-25; FR-28, RN-23). Recepción anota el RUT o NIT y el correo o el teléfono desde la
// estadía; la administración la marca enviada al contador y luego entregada. El sistema NO hace facturas (SOW §5).
// Los datos solo los ven recepción y la administración; la auditoría guarda el estado, nunca los datos.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';
import { ErrorApi } from '../comun/errores.ts';
import { fechaPrevista, fechaPrevistaHasta } from './fechas.ts';

type Estado = 'PENDIENTE' | 'ENVIADA_AL_CONTADOR' | 'ENTREGADA';
interface Datos { documento: string; correo?: string; telefono?: string }
interface Fila {
  id: string; estadia_id: string; habitacion_numero: string; documento: string | null; correo: string | null; telefono: string | null;
  estado: Estado; fecha_prevista: string; registrada_por: string; registrada_en: Date;
  enviada_por: string | null; enviada_en: Date | null; entregada_por: string | null; entregada_en: Date | null;
}

const ESTADOS: Estado[] = ['PENDIENTE', 'ENVIADA_AL_CONTADOR', 'ENTREGADA'];
/** Cada estado solo avanza al siguiente (T2-20): primero al contador y luego al huésped. */
const SIGUIENTE: Partial<Record<Estado, Estado>> = { PENDIENTE: 'ENVIADA_AL_CONTADOR', ENVIADA_AL_CONTADOR: 'ENTREGADA' };
const ID = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } };
const DATOS = {
  type: 'object', additionalProperties: false, required: ['documento'],
  // Basta el RUT o NIT (10.09) con el correo o el teléfono para que el contador la haga llegar [P].
  anyOf: [{ required: ['correo'] }, { required: ['telefono'] }],
  properties: {
    documento: { type: 'string', pattern: '^[0-9]{5,12}(-[0-9])?$' },
    correo: { type: 'string', format: 'email', maxLength: 120 },
    telefono: { type: 'string', pattern: String.raw`^\+57[0-9]{10}$` },
  },
};

const fechaHora = (d: Date | null) => (d ? aBogota(new Date(d)) : null);

async function leer(bd: Bd, filtro: { id?: string; estadiaId?: string; estados?: Estado[] }) {
  const filas = await bd.consultar<Fila>(
    `SELECT s.id, s.estadia_id, e.habitacion_numero, s.documento, s.correo, s.telefono, s.estado,
            to_char(s.fecha_prevista, 'YYYY-MM-DD') AS fecha_prevista, r.usuario AS registrada_por, s.registrada_en,
            env.usuario AS enviada_por, s.enviada_en, ent.usuario AS entregada_por, s.entregada_en
       FROM solicitudes_factura s JOIN estadias e ON e.id = s.estadia_id JOIN usuarios r ON r.id = s.registrada_por
       LEFT JOIN usuarios env ON env.id = s.enviada_por LEFT JOIN usuarios ent ON ent.id = s.entregada_por
      WHERE ($1::uuid IS NULL OR s.id = $1) AND ($2::uuid IS NULL OR s.estadia_id = $2) AND ($3::text[] IS NULL OR s.estado = ANY($3))
      ORDER BY s.registrada_en, s.id`, [filtro.id ?? null, filtro.estadiaId ?? null, filtro.estados ?? null]);
  return filas.map((f) => ({
    ...f, fecha_prevista_hasta: fechaPrevistaHasta(new Date(f.registrada_en)),
    registrada_en: fechaHora(f.registrada_en), enviada_en: fechaHora(f.enviada_en), entregada_en: fechaHora(f.entregada_en),
  }));
}

export function rutasFacturacion(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const turno = requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']);
  const administracion = requiere(bd, ahora, ['ADMINISTRACION']);

  app.post<{ Params: { id: string }; Body: Datos }>('/estadias/:id/solicitudes-factura', {
    preHandler: turno, schema: { params: ID, body: DATOS },
  }, async (req, rep) => {
    const u = req.usuario!;
    const id = await bd.transaccion(async (tx) => {
      const momento = ahora();
      const [e] = await tx.consultar<{ id: string }>('SELECT id FROM estadias WHERE id = $1', [req.params.id]);
      if (!e) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La estadía no existe.');
      const [s] = await tx.consultar<{ id: string }>(
        `INSERT INTO solicitudes_factura (estadia_id, documento, correo, telefono, fecha_prevista, registrada_por, registrada_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.params.id, req.body.documento, req.body.correo ?? null, req.body.telefono ?? null, fechaPrevista(momento), u.id, momento]);
      await auditar(tx, { usuarioId: u.id, accion: 'CREAR', entidad: 'solicitudes_factura', entidadId: s.id, detalle: { estado: 'PENDIENTE' }, ocurrido: momento });
      return s.id;
    });
    const [s] = await leer(bd, { id });
    return rep.code(201).send(s);
  });

  app.get<{ Params: { id: string } }>('/estadias/:id/solicitudes-factura', {
    preHandler: turno, schema: { params: ID },
  }, async (req) => ({ items: await leer(bd, { estadiaId: req.params.id }) }));

  app.get<{ Querystring: { estado?: Estado[] } }>('/solicitudes-factura', {
    preHandler: administracion,
    schema: { querystring: { type: 'object', additionalProperties: false, properties: { estado: { type: 'array', items: { type: 'string', enum: ESTADOS } } } } },
  }, async (req) => ({ items: await leer(bd, { estados: req.query.estado }) }));

  app.patch<{ Params: { id: string }; Body: { estado: Estado } }>('/solicitudes-factura/:id', {
    preHandler: administracion,
    schema: { params: ID, body: { type: 'object', additionalProperties: false, required: ['estado'], properties: { estado: { type: 'string', enum: ['ENVIADA_AL_CONTADOR', 'ENTREGADA'] } } } },
  }, async (req) => {
    const u = req.usuario!;
    const nuevo = req.body.estado;
    await bd.transaccion(async (tx) => {
      const momento = ahora();
      const [s] = await tx.consultar<{ estado: Estado }>('SELECT estado FROM solicitudes_factura WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!s) throw new ErrorApi(404, 'NO_ENCONTRADO', 'La solicitud de factura no existe.');
      if (SIGUIENTE[s.estado] !== nuevo) {
        let texto = 'ya se envió al contador';
        if (s.estado === 'ENTREGADA') texto = 'ya se entregó';
        else if (s.estado === 'PENDIENTE') texto = 'primero tiene que quedar enviada al contador';
        throw new ErrorApi(409, 'TRANSICION_INVALIDA', `Esa solicitud ${texto}.`);
      }
      const columnas = nuevo === 'ENTREGADA' ? 'entregada_por = $3, entregada_en = $4' : 'enviada_por = $3, enviada_en = $4';
      await tx.consultar(`UPDATE solicitudes_factura SET estado = $2, ${columnas} WHERE id = $1`, [req.params.id, nuevo, u.id, momento]);
      await auditar(tx, { usuarioId: u.id, accion: 'ACTUALIZAR', entidad: 'solicitudes_factura', entidadId: req.params.id, detalle: { estado: nuevo }, ocurrido: momento });
    });
    const [s] = await leer(bd, { id: req.params.id });
    return s;
  });
}
