// Quiénes se quedan hoy (TICKET-34; FR-31, RN-16): cuando la policía pasa de rutina, mira quiénes se quedan esa noche y
// valida el documento en su teléfono; no se le envía nada (administradora, HG-ACT-001 V5-02). El sistema reemplaza el
// talonario, así que recepción necesita esta lista con el documento completo. Solo se muestra: no se exporta.
// Cada consulta queda en la auditoría (quién y cuándo), sin los datos.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { aBogota } from '../comun/tiempo.ts';

interface Fila { habitacion_numero: string; nombre: string; tipo_documento: string | null; numero_documento: string | null; entrada_en: Date; salida_prevista_en: Date }

export function rutasHuespedesHoy(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get('/huespedes/hoy', { preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']) }, async (req) => {
    const filas = await bd.consultar<Fila>(
      `SELECT e.habitacion_numero, h.nombre, h.tipo_documento, h.numero_documento, e.entrada_en, e.salida_prevista_en
         FROM estadias e JOIN huespedes h ON h.id = e.huesped_id
        WHERE e.estado = 'ACTIVA' AND h.anonimizado_en IS NULL
        ORDER BY e.habitacion_numero`);
    const momento = ahora();
    await auditar(bd, { usuarioId: req.usuario!.id, accion: 'CONSULTAR', entidad: 'huespedes', entidadId: aBogota(momento), detalle: { cantidad: String(filas.length) }, ocurrido: momento });
    return {
      items: filas.map((f) => ({ ...f, entrada_en: aBogota(new Date(f.entrada_en)), salida_prevista_en: aBogota(new Date(f.salida_prevista_en)) })),
    };
  });
}
