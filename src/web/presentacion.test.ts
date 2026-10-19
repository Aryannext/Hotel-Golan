// Textos de pantalla que antes estaban en ternarios anidados dentro de los componentes (SonarCloud S3358).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  accionCuarto, claseAsistente, cuantos, detalleCuarto, etiquetaCampana, icoMovimiento, icoTono, notaCobro, notaFranja, pillEstadoPago,
  nombreTipoDocumento, pistaCuarto, textoCambio, textoDesistimiento, textoDevolucion, textoDocumento, tituloFicha,
} from './presentacion.ts';
import type { Habitacion } from './api.ts';

describe('cuantos: número con su palabra en singular o plural', () => {
  it('1 en singular; 0 y varios en plural', () => {
    assert.equal(cuantos(1, 'noche', 'noches'), '1 noche');
    assert.equal(cuantos(3, 'noche', 'noches'), '3 noches');
    assert.equal(cuantos(0, 'producto', 'productos'), '0 productos');
  });
});

describe('etiquetaCampana', () => {
  it('dice cuántos avisos hay', () => {
    assert.equal(etiquetaCampana(0), 'Avisos: no hay pendientes');
    assert.equal(etiquetaCampana(1), 'Avisos: 1 pendiente');
    assert.equal(etiquetaCampana(5), 'Avisos: 5 pendientes');
  });
});

describe('íconos', () => {
  it('icoTono: alerta, éxito o información', () => {
    assert.deepEqual(['alerta', 'exito', 'info'].map((t) => icoTono(t)), ['alerta', 'check', 'info']);
  });
  it('icoMovimiento: salida, efectivo o transferencia', () => {
    assert.equal(icoMovimiento({ valor: -10000, enCaja: true }), 'baja');
    assert.equal(icoMovimiento({ valor: 45000, enCaja: true }), 'efectivo');
    assert.equal(icoMovimiento({ valor: 30000, enCaja: false }), 'transferencia');
  });
});

describe('textoCambio', () => {
  it('vueltas, abono (con su texto) o pago exacto', () => {
    assert.equal(textoCambio('vueltas', 'Queda debiendo'), 'Vueltas');
    assert.equal(textoCambio('abono', 'Queda debiendo'), 'Queda debiendo');
    assert.equal(textoCambio('exacto', 'Queda debiendo'), 'Pago exacto');
  });
});

describe('claseAsistente', () => {
  it('marca el paso activo y los ya hechos', () => {
    assert.equal(claseAsistente(2, 0), 'asistente__paso asistente__paso--hecho');
    assert.equal(claseAsistente(2, 1), 'asistente__paso asistente__paso--activo');
    assert.equal(claseAsistente(2, 2), 'asistente__paso');
  });
});

describe('notas de la cotización', () => {
  it('notaFranja explica la salida especial', () => {
    assert.equal(notaFranja('VEINTICUATRO_HORAS'), ' (entró de 6:01 a 9:59 a. m.: 24 horas).');
    assert.equal(notaFranja('MADRUGADA_MISMO_DIA'), ' (entró de madrugada: sale hoy al mediodía).');
    assert.equal(notaFranja('MEDIODIA_SIGUIENTE'), '');
  });
  it('notaCobro dice cuándo se cobra', () => {
    assert.equal(notaCobro(true, 'NOCHE'), 'Una noche se puede cobrar al salir.');
    assert.equal(notaCobro(false, 'NOCHE'), 'Varias noches se cobran por adelantado.');
    assert.equal(notaCobro(false, 'TRES_HORAS'), '');
  });
});

describe('cuarto del mapa', () => {
  const hab = (estado: string, estadia: Partial<NonNullable<Habitacion['estadia_activa']>> | null = null): Habitacion => ({
    numero: '205', tipo: 'VENTILADOR', estado, nota: null,
    estadia_activa: estadia && { id: 'e1', nombre_corto: 'Huésped P.', salida_prevista_en: '2026-10-14T12:00:00-05:00', saldo: 0, por_verificar: 0, vencida: false, ...estadia },
  });
  const todas = { elegir: true, abrir: true, revisar: true };
  it('detalle: salida y, si aplica, lo que debe o lo que falta verificar', () => {
    assert.equal(detalleCuarto(hab('DISPONIBLE'), '2026-10-13'), '');
    assert.equal(detalleCuarto(hab('OCUPADA', {}), '2026-10-13'), 'Sale mañana 12:00 m.');
    assert.equal(detalleCuarto(hab('OCUPADA', { saldo: 28000, por_verificar: 30000 }), '2026-10-13'), 'Sale mañana 12:00 m. · debe $28.000');
    assert.equal(detalleCuarto(hab('OCUPADA', { por_verificar: 30000 }), '2026-10-13'), 'Sale mañana 12:00 m. · por verificar');
  });
  it('acción: entrada si está disponible, cuenta si tiene estadía, estado si no', () => {
    assert.equal(accionCuarto(hab('DISPONIBLE'), todas), 'ENTRADA');
    assert.equal(accionCuarto(hab('OCUPADA', {}), todas), 'CUENTA');
    assert.equal(accionCuarto(hab('POR_REVISAR'), todas), 'ESTADO');
    assert.equal(accionCuarto(hab('DISPONIBLE'), { elegir: false, abrir: true, revisar: true }), null);
  });
  it('pista para el lector de pantalla según la acción', () => {
    assert.equal(pistaCuarto('ENTRADA'), ', tocar para registrar una entrada');
    assert.equal(pistaCuarto('CUENTA'), ', tocar para ver la cuenta');
    assert.equal(pistaCuarto('ESTADO'), ', tocar para cambiar su estado');
    assert.equal(pistaCuarto(null), '');
  });
});

describe('ficha', () => {
  it('tituloFicha según la vista', () => {
    assert.equal(tituloFicha('cuenta', '205'), 'Hab. 205');
    assert.equal(tituloFicha('devolucion', '205'), 'Devolución por desistimiento');
    assert.equal(tituloFicha('salida', '205'), 'Dar salida');
  });
  it('pillEstadoPago: por verificar, no llegó, verificado', () => {
    assert.deepEqual(pillEstadoPago('POR_VERIFICAR'), ['pill--aviso', 'Por verificar']);
    assert.deepEqual(pillEstadoPago('RECHAZADO'), ['pill--alerta', 'No llegó']);
    assert.deepEqual(pillEstadoPago('VERIFICADO', 'Llegó'), ['pill--exito', 'Llegó']);
    assert.equal(pillEstadoPago('EN_CAJA'), null);
  });
  it('textoDevolucion: de dónde sale lo que se devuelve', () => {
    assert.equal(textoDevolucion(45000, 'EFECTIVO'), 'Sale de la caja del turno; no cuenta como venta.');
    assert.equal(textoDevolucion(45000, 'TRANSFERENCIA'), 'La administración hace la transferencia.');
    assert.equal(textoDevolucion(0, 'EFECTIVO'), 'La estadía se cierra y la habitación pasa a revisión.');
  });
  it('textoDesistimiento: con o sin devolución', () => {
    assert.equal(textoDesistimiento('205', { valor: 45000, medio: 'EFECTIVO' }),
      'Desistimiento registrado en la 205: se devolvieron $45.000 de la caja. La habitación queda por revisar.');
    assert.equal(textoDesistimiento('205', { valor: 45000, medio: 'TRANSFERENCIA' }),
      'Desistimiento registrado en la 205: se devolvieron $45.000 por transferencia. La habitación queda por revisar.');
    assert.equal(textoDesistimiento('205', { valor: 0, medio: null }), 'Desistimiento registrado en la 205, sin devolución. La habitación queda por revisar.');
  });
});

describe('FR-31 — quiénes se quedan hoy', () => {
  it('muestra el documento completo con el nombre del tipo, o «Sin documento»', () => {
    assert.equal(textoDocumento({ tipo_documento: 'CC', numero_documento: 'PRUEBA0001' }), 'Cédula PRUEBA0001');
    assert.equal(textoDocumento({ tipo_documento: 'PASAPORTE', numero_documento: 'PRUEBA0208' }), 'Pasaporte PRUEBA0208');
    assert.equal(nombreTipoDocumento('PPT'), 'Permiso (PPT)');
    assert.equal(nombreTipoDocumento('OTRO'), 'OTRO');
    assert.equal(textoDocumento({ tipo_documento: null, numero_documento: null }), 'Sin documento');
  });
});
