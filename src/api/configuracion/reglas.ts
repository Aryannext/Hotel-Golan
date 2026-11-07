// Reglas numéricas configurables (FR-22): valor por hora, hora de la noche completa, descuento, pagos de turno y retención.
// Aplican a lo nuevo: los cargos ya hechos guardan su valor y cada turno guarda su pago al abrirse.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere } from '../identidad/sesiones.ts';
import { auditar } from '../comun/auditoria.ts';
import { ErrorApi } from '../comun/errores.ts';

/** Valor de una regla del hotel (tabla `reglas`). La usan estadías, caja, migración y privacidad (HG-HAL-001 HAL-41). */
export async function regla(bd: Bd, clave: string): Promise<number> {
  const [r] = await bd.consultar<{ valor: number }>('SELECT valor FROM reglas WHERE clave = $1', [clave]);
  if (!r) throw new Error(`Falta la regla ${clave}`);
  return r.valor;
}

const LIMITES = {
  valor_hora: { minimum: 0, maximum: 1000000 },
  hora_noche_completa: { minimum: 12, maximum: 23 },
  descuento_noche: { minimum: 0, maximum: 1000000 },
  pago_turno_dia: { minimum: 0, maximum: 10000000 },
  pago_turno_noche: { minimum: 0, maximum: 10000000 },
  retencion_datos_dias: { minimum: 1, maximum: 3650 },
  // TICKET-26: minutos desde la entrada en que un cambio de habitación ajusta la diferencia (V5-03, «3 o 5») [P/V].
  minutos_cambio_sin_cargo: { minimum: 0, maximum: 120 },
  // TICKET-37: horas para marcar «atrasado» un reporte a Migración; el plazo legal está por confirmar [P/V].
  horas_reporte_migracion: { minimum: 1, maximum: 720 },
};
type Clave = keyof typeof LIMITES;
const CLAVES = Object.keys(LIMITES) as Clave[];

async function leerReglas(bd: Bd): Promise<Record<Clave, number>> {
  const filas = await bd.consultar<{ clave: Clave; valor: number }>('SELECT clave, valor FROM reglas');
  const valores = new Map(filas.map((f) => [f.clave, f.valor]));
  return Object.fromEntries(CLAVES.map((k) => [k, valores.get(k)])) as Record<Clave, number>;
}

export function rutasReglas(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  app.get('/reglas', { preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']) }, async () => leerReglas(bd));

  app.patch<{ Body: Partial<Record<Clave, number>> }>('/reglas', {
    preHandler: requiere(bd, ahora, ['ADMINISTRACION']),
    schema: { body: {
      type: 'object', additionalProperties: false, minProperties: 1,
      properties: Object.fromEntries(CLAVES.map((k) => [k, { type: 'integer', ...LIMITES[k] }])),
    } },
  }, async (req) => {
    const momento = ahora();
    const cambios = Object.entries(req.body) as Array<[Clave, number]>;
    await bd.transaccion(async (tx) => {
      const hechas = await tx.consultar<{ clave: string }>(
        `UPDATE reglas r SET valor = c.valor, actualizado_por = $3, actualizado_en = $4
           FROM unnest($1::text[], $2::int[]) AS c(clave, valor) WHERE r.clave = c.clave RETURNING r.clave`,
        [cambios.map(([clave]) => clave), cambios.map(([, valor]) => valor), req.usuario!.id, momento]);
      // HAL-22: si falta una regla en la base (una migración sin correr), no se responde 200 como si se hubiera guardado.
      const falta = cambios.find(([clave]) => !hechas.some((h) => h.clave === clave));
      if (falta) throw new ErrorApi(409, 'CONFLICTO', `Falta la regla «${falta[0]}» en la base. Hay que correr las migraciones (npm run db:migrar).`);
      await auditar(tx, {
        usuarioId: req.usuario!.id, accion: 'ACTUALIZAR', entidad: 'reglas', entidadId: 'reglas', ocurrido: momento,
        detalle: Object.fromEntries(cambios.map(([k, v]) => [k, String(v)])),
      });
    });
    return leerReglas(bd);
  });
}
