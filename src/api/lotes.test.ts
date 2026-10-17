// Inserción en lote (una sola consulta) de eventos y auditoría: mismo resultado que fila por fila, en el mismo orden.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { conectarPglite, type Bd } from '../../scripts/lib/bd.ts';
import { aplicarMigraciones } from '../../scripts/lib/migraciones.ts';
import { publicarEventos } from './comun/eventos.ts';
import { auditarVarios } from './comun/auditoria.ts';

describe('inserción en lote', () => {
  let bd: Bd;
  const momento = new Date('2026-10-13T10:00:00-05:00');
  before(async () => { bd = await conectarPglite(); await aplicarMigraciones(bd); });
  after(async () => { await bd.cerrar(); });

  it('publicarEventos guarda todos los eventos en el orden dado, con su payload', async () => {
    await publicarEventos(bd, [
      ['estadia.cerrada', { entidad_id: 'e1', habitacion_numero: '205' }],
      ['habitacion.actualizada', { numero: '205', estado: 'POR_REVISAR' }],
      ['caja.movimiento', { entidad_id: 'm1', valor: 45000 }],
    ], momento);
    const filas = await bd.consultar<{ tipo: string; payload: Record<string, unknown>; ocurrido_en: Date }>(
      'SELECT tipo, payload, ocurrido_en FROM eventos_salida ORDER BY id');
    assert.deepEqual(filas.map((f) => f.tipo), ['estadia.cerrada', 'habitacion.actualizada', 'caja.movimiento']);
    assert.deepEqual(filas[2].payload, { entidad_id: 'm1', valor: 45000 });
    assert.equal(new Date(filas[0].ocurrido_en).getTime(), momento.getTime());
  });

  it('publicarEventos sin eventos no hace nada', async () => {
    const antes = (await bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM eventos_salida'))[0].n;
    await publicarEventos(bd, [], momento);
    assert.equal((await bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM eventos_salida'))[0].n, antes);
  });

  it('auditarVarios guarda una fila por registro, en orden y con su detalle', async () => {
    await auditarVarios(bd, [
      { usuarioId: null, accion: 'CREAR', entidad: 'cargos', entidadId: 'c1', detalle: { valor: '4000' }, ocurrido: momento },
      { usuarioId: null, accion: 'CREAR', entidad: 'cargos', entidadId: 'c2', ocurrido: momento },
    ]);
    const filas = await bd.consultar<{ entidad_id: string; detalle: Record<string, string> }>(
      `SELECT entidad_id, detalle FROM auditoria WHERE entidad = 'cargos' ORDER BY id`);
    assert.deepEqual(filas.map((f) => [f.entidad_id, f.detalle]), [['c1', { valor: '4000' }], ['c2', {}]]);
  });
});
