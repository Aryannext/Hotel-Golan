// TICKET-14 · presentación de usuarios y actividad (FR-18, FR-20) para la administración.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { erroresUsuarioNuevo, estadoUsuario, sugerirUsuario, textoActividad } from './equipo.ts';

describe('FR-18 — usuarios en la PWA', () => {
  it('sugiere un usuario válido a partir del nombre, sin tildes ni espacios', () => {
    assert.equal(sugerirUsuario('Laura Gómez'), 'laura.gomez');
    assert.equal(sugerirUsuario('  María José Peña Ríos '), 'maria.pena');
    assert.equal(sugerirUsuario('Ana'), 'ana');
    assert.equal(sugerirUsuario('Al'), '');
  });

  it('valida el formulario de usuario nuevo con mensajes sencillos', () => {
    const bien = { nombre: 'Recepción Prueba 5', usuario: 'recepcion5', pin: '246813', confirmar: '246813' };
    assert.deepEqual(erroresUsuarioNuevo(bien), {});
    const mal = erroresUsuarioNuevo({ nombre: ' ', usuario: 'Laura Gómez', pin: '12345', confirmar: '54321' });
    assert.deepEqual(Object.keys(mal).sort(), ['confirmar', 'nombre', 'pin', 'usuario']);
    assert.match(mal.pin!, /6 números/);
    assert.match(mal.usuario!, /minúsculas/);
    assert.deepEqual(erroresUsuarioNuevo({ ...bien, confirmar: '246812' }), { confirmar: 'Los dos PIN no coinciden.' });
  });

  it('muestra si la persona está activa, desactivada o bloqueada (con la hora en Bogotá)', () => {
    const base = { id: 'u1', nombre: 'Recepción Prueba 4', usuario: 'recepcion4', rol: 'RECEPCION' as const };
    assert.deepEqual(estadoUsuario({ ...base, activo: true, bloqueado_hasta: null }), { tono: 'exito', texto: 'Activo' });
    assert.deepEqual(estadoUsuario({ ...base, activo: false, bloqueado_hasta: null }), { tono: 'neutro', texto: 'Desactivado' });
    assert.deepEqual(estadoUsuario({ ...base, activo: true, bloqueado_hasta: '2026-10-13T07:15:00-05:00' }),
      { tono: 'alerta', texto: 'Bloqueado hasta las 7:15 a. m.' });
  });
});

describe('FR-20 — actividad en palabras', () => {
  const r = (accion: string, entidad: string, detalle: Record<string, string> = {}, entidad_id = 'x') =>
    ({ id: 1, usuario: 'recepcion1', accion, entidad, entidad_id, ocurrido_en: '2026-10-13T07:00:00-05:00', detalle });
  const nombres = { u3: 'recepcion3' };

  it('describe cada acción sin tecnicismos', () => {
    const casos: Array<[ReturnType<typeof r>, string]> = [
      [r('INICIAR_SESION', 'sesiones'), 'Entró al sistema'],
      [r('CERRAR_SESION', 'sesiones'), 'Cerró sesión'],
      [r('BLOQUEAR', 'usuarios', {}, 'u3'), 'Se bloqueó a recepcion3 por 5 PIN equivocados'],
      [r('RECIBIR_TURNO', 'turnos', { base_contada: '208500', diferencia: '0' }), 'Recibió el turno con $208.500'],
      [r('ENTREGAR_TURNO', 'turnos', { contado: '184500', diferencia: '-2000' }), 'Entregó el turno con $184.500 (faltaron $2.000)'],
      [r('ENTREGAR_TURNO', 'turnos', { contado: '184500', diferencia: '0' }), 'Entregó el turno con $184.500'],
      [r('CREAR', 'estadias', { habitacion: '206', total: '45000' }), 'Registró una entrada en la habitación 206 por $45.000'],
      [r('CREAR', 'pagos', { medio: 'NEQUI', valor: '30000' }), 'Registró un cobro de $30.000 por Nequi'],
      [r('VERIFICAR', 'pagos', { resultado: 'LLEGO' }), 'Confirmó que llegó una transferencia'],
      [r('VERIFICAR', 'pagos', { resultado: 'NO_LLEGO' }), 'Marcó que no llegó una transferencia'],
      [r('CREAR', 'cargos', { valor: '8000' }), 'Agregó un consumo o cargo de $8.000'],
      [r('CREAR', 'movimientos_caja', { valor: '10000' }), 'Sacó $10.000 de la caja'],
      [r('CREAR', 'devoluciones', { valor: '45000' }), 'Devolvió $45.000 a un huésped que desistió'],
      [r('ACTUALIZAR', 'estadias', { accion: 'SALIDA' }), 'Dio salida a una habitación'],
      [r('ACTUALIZAR', 'estadias', { accion: 'EXTENSION', valor: '8000' }), 'Extendió una estadía por $8.000'],
      [r('ACTUALIZAR', 'habitaciones', { de: 'POR_REVISAR', a: 'LIMPIEZA' }, '206'), 'Pasó la habitación 206 de Por revisar a Limpieza'],
      [r('ANULAR', 'pagos', { valor: '4000' }), 'Anuló un cobro de $4.000'],
      [r('ANULAR', 'movimientos_caja', { valor: '10000' }), 'Anuló una salida de dinero de $10.000'],
      [r('CREAR', 'usuarios', { rol: 'RECEPCION' }, 'u3'), 'Creó el usuario recepcion3 (recepción)'],
      [r('ACTUALIZAR', 'usuarios', { activo: 'no' }, 'u3'), 'Desactivó a recepcion3'],
      [r('ACTUALIZAR', 'usuarios', { activo: 'si' }, 'u3'), 'Reactivó a recepcion3'],
      [r('ACTUALIZAR', 'usuarios', { pin: 'cambiado' }, 'u3'), 'Cambió el PIN de recepcion3'],
      [r('ACTUALIZAR', 'usuarios', { desbloqueo: 'si' }, 'u3'), 'Desbloqueó a recepcion3'],
      [r('ANONIMIZAR', 'huespedes'), 'Borró los datos de huéspedes vencidos'],
      [r('ANONIMIZAR', 'huespedes', { cantidad: '1' }), 'Borró los datos personales de 1 huésped (plazo de retención cumplido)'],
      [r('ANONIMIZAR', 'huespedes', { cantidad: '3' }), 'Borró los datos personales de 3 huéspedes (plazo de retención cumplido)'],
      [r('ACTUALIZAR', 'tarifas', { 'AIRE NOCHE 1': '65000' }), 'Cambió la tarifa Aire · noche · 1 persona a $65.000'],
      [r('ACTUALIZAR', 'tarifas', { 'AIRE NOCHE 1': '65000', 'VENTILADOR TRES_HORAS 2': '27000' }),
        'Cambió la tarifa Aire · noche · 1 persona a $65.000; Ventilador · tres horas (1 o 2 personas) a $27.000'],
      [r('ACTUALIZAR', 'reglas', { descuento_noche: '6000', hora_noche_completa: '17' }),
        'Cambió Descuento máximo por noche: $6.000; Desde qué hora se cobra la noche completa: 5:00 p. m.'],
      [r('CREAR', 'productos', { precio: '5500' }), 'Agregó un producto de $5.500 al catálogo'],
      [r('ACTUALIZAR', 'productos', { precio: '4500' }), 'Cambió el precio de un producto a $4.500'],
      [r('ACTUALIZAR', 'productos', { activo: 'no' }), 'Quitó un producto del catálogo'],
      [r('ACTUALIZAR', 'productos', { activo: 'si' }), 'Volvió a poner un producto en el catálogo'],
      [r('ACTUALIZAR', 'productos', { nombre: 'Agua grande' }), 'Cambió el producto «Agua grande» del catálogo'],
      [r('CREAR', 'solicitudes_factura', { estado: 'PENDIENTE' }), 'Anotó una solicitud de factura'],
      [r('ACTUALIZAR', 'solicitudes_factura', { estado: 'ENVIADA_AL_CONTADOR' }), 'Pasó una solicitud de factura al contador'],
      [r('ACTUALIZAR', 'solicitudes_factura', { estado: 'ENTREGADA' }), 'Marcó una factura como entregada al huésped'],
      [r('ANONIMIZAR', 'solicitudes_factura', { cantidad: '2' }), 'Borró los datos de 2 solicitudes de factura (plazo de retención cumplido)'],
    ];
    for (const [registro, texto] of casos) assert.equal(textoActividad(registro, nombres), texto, `${registro.accion} ${registro.entidad}`);
  });

  it('un usuario que ya no está en la lista o una acción nueva no rompen la pantalla', () => {
    assert.equal(textoActividad(r('ACTUALIZAR', 'usuarios', { activo: 'no' }, 'u9'), nombres), 'Desactivó a un usuario');
    assert.equal(textoActividad(r('CREAR', 'reservas'), nombres), 'Creó: reservas');
  });
});
