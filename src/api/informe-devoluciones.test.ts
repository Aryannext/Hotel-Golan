// HG-HAL-001 HAL-17 · decisión del usuario (27-10-2026): una devolución por transferencia («solo miró», la decide la
// administración) se resta de las transferencias del informe el día en que se devuelve. El día del cobro no se
// reescribe. Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
let admin: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T05:00:00-05:00'); // día del hotel 12-10 (turno de noche)
  recepcion = await e.entrar('recepcion2');
  admin = await e.entrar('admin');
});
after(async () => e.cerrar());

const dia = async (fecha: string) => (await e.app.inject({ method: 'GET', url: `/api/v1/reportes/dias?desde=${fecha}&hasta=${fecha}`, headers: { cookie: admin } }))
  .json().items[0] as { transferencias_verificadas: number; transferencias_devueltas: number } | undefined;

async function entradaPorNequi(habitacion: string) {
  const r = await e.app.inject({ method: 'POST', url: '/api/v1/estadias', headers: { cookie: recepcion }, payload: {
    habitacion_numero: habitacion, modalidad: 'NOCHE', personas: 1,
    huesped: { nombre: `Huésped Prueba ${habitacion}`, tipo_documento: 'CC', numero_documento: `PRUEBA${habitacion}`, nacionalidad: 'Colombia', es_menor: false },
    autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'NEQUI' },
  } });
  assert.equal(r.statusCode, 201, r.body);
  const est = r.json();
  await e.app.inject({ method: 'POST', url: `/api/v1/pagos/${est.pagos[0].id}/verificacion`, payload: { resultado: 'LLEGO' }, headers: { cookie: admin } });
  return est as { id: string; pagos: Array<{ valor: number }> };
}
const devolver = (id: string) => e.app.inject({ method: 'POST', url: `/api/v1/estadias/${id}/devoluciones`, headers: { cookie: admin },
  payload: { motivo: 'SOLO_MIRO', medio: 'TRANSFERENCIA' } });

describe('HAL-17 — devolución por transferencia en el informe del día', () => {
  it('devuelta el mismo día: las transferencias del día bajan en ese valor y se muestra lo devuelto', async () => {
    const antes = (await dia('2026-10-12'))!.transferencias_verificadas;
    const est = await entradaPorNequi('206');
    assert.equal((await dia('2026-10-12'))!.transferencias_verificadas, antes + 45000);
    assert.equal((await devolver(est.id)).statusCode, 201);
    const d = (await dia('2026-10-12'))!;
    assert.deepEqual([d.transferencias_verificadas, d.transferencias_devueltas], [antes, 45000]);
  });

  it('devuelta al día siguiente: el día del cobro no cambia y el de la devolución la resta', async () => {
    const est = await entradaPorNequi('208');
    const cobro = (await dia('2026-10-12'))!.transferencias_verificadas;
    e.fijarHora('2026-10-13T08:00:00-05:00'); // día del hotel 13-10; sigue abierto el turno de noche
    admin = await e.entrar('admin');
    assert.equal((await devolver(est.id)).statusCode, 201);
    assert.equal((await dia('2026-10-12'))!.transferencias_verificadas, cobro);
    const siguiente = (await dia('2026-10-13'))!;
    assert.deepEqual([siguiente.transferencias_verificadas, siguiente.transferencias_devueltas], [-45000, 45000]);
  });
});
