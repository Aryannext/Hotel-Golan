// TICKET-23 · lavandería en la PWA: cuánto falta del pedido y textos de la lista y la entrega.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { faltaDelPedido, quienPidio, textoEntrega } from './lavanderia.ts';
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
