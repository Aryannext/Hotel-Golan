// HG-HAL-001 HAL-15 · el desistimiento («solo miró», RN-08) devuelve lo pagado menos lo que ya se devolvió en un cambio
// de habitación (RN-17): nunca más de lo que el huésped dejó en el hotel. Datos sintéticos.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let recepcion: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T15:00:00-05:00');
  recepcion = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

const pedir = (url: string, payload: unknown) =>
  e.app.inject({ method: 'POST', url: `/api/v1${url}`, payload: payload as object, headers: { cookie: recepcion } });

describe('HAL-15 — devolución después de un cambio a una habitación más barata', () => {
  it('pagó $60.000 en la 201, le devolvieron $15.000 al pasar a la 206 y «solo miró»: se devuelven $45.000', async () => {
    const entrada = await pedir('/estadias', {
      habitacion_numero: '201', modalidad: 'NOCHE', personas: 1,
      huesped: { nombre: 'Huésped Prueba 201', tipo_documento: 'CC', numero_documento: 'PRUEBA0201', nacionalidad: 'Colombia', es_menor: false },
      autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 60000 },
    });
    assert.equal(entrada.statusCode, 201, entrada.body);
    const id = entrada.json().id as string;
    e.avanzarMinutos(2);
    const cambio = await pedir(`/estadias/${id}/cambio-habitacion`, { habitacion_numero: '206' });
    assert.equal(cambio.statusCode, 200, cambio.body);
    assert.equal(cambio.json().cuenta.devuelto, 15000);

    const d = await pedir(`/estadias/${id}/devoluciones`, { motivo: 'SOLO_MIRO', medio: 'EFECTIVO' });
    assert.equal(d.statusCode, 201, d.body);
    assert.equal(d.json().valor, 45000);
  });
});
