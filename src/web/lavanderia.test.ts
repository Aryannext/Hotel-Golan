// TICKET-23 · lavandería en la PWA: cuánto falta del pedido y textos de la lista y la entrega.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { faltaDelPedido, faltaParaEntregar, quienPidio, textoEntrega } from './lavanderia.ts';
import { origenPago } from './ventas.ts';
import { lineasDelTurno } from './logica.ts';
import { tituloFicha } from './presentacion.ts';

describe('lo que falta por pagar del pedido', () => {
  it('es el valor del pedido, sin pasar del saldo de la cuenta', () => {
    assert.equal(faltaDelPedido(7000, 7000), 7000);
    assert.equal(faltaDelPedido(7000, 30000), 7000);
    assert.equal(faltaDelPedido(7000, 2000), 2000);
    assert.equal(faltaDelPedido(7000, 0), 0);
    assert.equal(faltaDelPedido(7000, -1000), 0);
  });
});

describe('textos', () => {
  it('quién pidió: la habitación o el nombre del externo', () => {
    assert.equal(quienPidio({ habitacion_numero: '205', cliente_nombre: null }), 'Hab. 205');
    assert.equal(quienPidio({ habitacion_numero: null, cliente_nombre: 'Cliente Prueba' }), 'Cliente Prueba');
  });
  it('mensaje al entregar', () => {
    assert.equal(textoEntrega('Hab. 205', 'cobrado', 7000), 'Ropa entregada a Hab. 205. Se cobraron $7.000.');
    assert.equal(textoEntrega('Hab. 205', 'pagado', 0), 'Ropa entregada a Hab. 205. Ya estaba pagada.');
    assert.equal(textoEntrega('Hab. 205', 'sin_pago', 5000), 'Ropa entregada a Hab. 205 sin pago: quedan $5.000 por cobrar y queda registrado que usted lo autorizó.');
  });
  it('la ficha tiene la vista «Recibir lavandería»', () => {
    assert.equal(tituloFicha('lavanderia', '205'), 'Recibir lavandería');
  });
});

describe('TICKET-24 · externos', () => {
  const base = { id: 'p1', estadia_id: null, habitacion_numero: null, cliente_nombre: 'Cliente Prueba', detalle: 'Cobija × 1', total: 5000, estado: 'RECIBIDO',
    registrado_por: 'recepcion2', registrado_en: '2026-10-13T05:00:00-05:00', entregado_por: null, entregado_en: null, sin_pago_autorizado_por: null };
  it('lo que falta para entregar: el externo usa lo que debe el pedido; el huésped, su cuenta', () => {
    assert.equal(faltaParaEntregar({ ...base, por_cobrar: 5000 }, null), 5000);
    assert.equal(faltaParaEntregar({ ...base, por_cobrar: 0 }, null), 0);
    const delHuesped = { ...base, estadia_id: 'e1', habitacion_numero: '205', cliente_nombre: null, por_cobrar: null };
    assert.equal(faltaParaEntregar(delHuesped, 2000), 2000);
    assert.equal(faltaParaEntregar(delHuesped, null), null);
  });
  it('el cobro de un externo se ve como lavandería con su nombre', () => {
    const p = { id: 'g1', habitacion_numero: null, venta_detalle: null, lavanderia_cliente: 'Cliente Prueba', medio: 'NEQUI', valor: 5000, estado: 'POR_VERIFICAR',
      registrado_en: '2026-10-13T05:10:00-05:00', registrado_por: 'recepcion2', anulado: false };
    assert.equal(origenPago(p), 'Lavandería · Cliente Prueba');
    assert.equal(lineasDelTurno([p], [])[0].concepto, 'Lavandería · Cliente Prueba · Nequi');
  });
});
