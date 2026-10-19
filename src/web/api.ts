import type { CotizacionExtension, Producto, SalidaTurno, TipoSalida } from './logica.ts';
import type { RegistroActividad, UsuarioAdmin } from './equipo.ts';
import type { Reglas, Tarifa, TarifaInput } from './ajustes.ts';
import type { Existencia, PendienteMigracion, TipoReporte } from './avisos.ts';
import type { DatosHotel } from './aviso.ts';
import type { PedidoLavanderia } from './lavanderia.ts';
import type { EstadoFactura, SolicitudFactura, SolicitudInput } from './facturas.ts';
import type { CotizacionCambio } from './cambio.ts';

// Cliente de la API. La sesión viaja en la cookie HttpOnly; el navegador la envía sola (same-origin).
export interface Usuario { id: string; nombre: string; usuario: string; rol: 'RECEPCION' | 'ADMINISTRACION'; activo: boolean }
export interface SesionActual { usuario: Usuario; expira_en: string; turno_por_recibir: boolean }
export interface EstadiaResumen { id: string; nombre_corto: string; salida_prevista_en: string; saldo: number; por_verificar: number; vencida: boolean }
export interface Habitacion { numero: string; tipo: 'AIRE' | 'VENTILADOR'; estado: string; nota: string | null; estadia_activa: EstadiaResumen | null }

export interface Cotizacion {
  tarifa: number; descuento: number; total: number; salida_prevista_en: string; permite_pago_al_salir: boolean;
  franja_salida: 'MADRUGADA_MISMO_DIA' | 'VEINTICUATRO_HORAS' | 'MEDIODIA_SIGUIENTE' | 'TRES_HORAS';
}
export interface PedidoCotizacion { habitacion_numero: string; modalidad: 'NOCHE' | 'TRES_HORAS'; personas: number; noches: number; valor_descuento: number; entrada_en?: string }

export interface ResumenCaja {
  base_recibida: number; efectivo: number; salidas: number; debe_haber: number;
  transferencias: number; por_verificar_cantidad: number; pago_turno: number;
}
export interface Turno {
  id: string; tipo: 'DIA' | 'NOCHE'; estado: 'POR_RECIBIR' | 'ABIERTO' | 'CERRADO'; responsable: string | null; recibido_de: string | null;
  inicio_en: string; fin_en: string | null; fin_programado_en: string; base_entregada: number; base_recibida: number | null; caja: ResumenCaja;
  cierre: { pago_tomado: boolean; efectivo_esperado: number; efectivo_contado: number; diferencia: number; efectivo_esperado_ajustado: number; diferencia_ajustada: number;
    motivo_diferencia: string | null; entregado_por: string } | null;
}
export interface TurnoDetalle extends Turno { pagos: Pago[]; movimientos_caja: SalidaTurno[] }
export interface ResumenDia {
  dia: string; desde: string; hasta: string; turnos: Array<{ tipo: 'DIA' | 'NOCHE'; responsable: string }>;
  efectivo: number; transferencias_verificadas: number; transferencias_pendientes: number;
  descuentos: number; salidas: number; diferencias: number;
}

export interface Cargo { id: string; tipo: string; concepto: string; cantidad: number; valor_unitario: number; valor: number; creado_por: string; creado_en: string; anulado: boolean }
export interface Pago {
  id: string; estadia_id: string | null; habitacion_numero: string | null; venta_id: string | null; venta_detalle: string | null;
  pedido_lavanderia_id: string | null; lavanderia_cliente: string | null; turno_id: string; medio: MedioPago; valor: number;
  estado: string; registrado_por: string; registrado_en: string; verificado_por: string | null; verificado_en: string | null; anulado: boolean;
}
export interface Estadia {
  id: string; habitacion_numero: string; modalidad: string; personas: number; noches: number; entrada_en: string; salida_prevista_en: string;
  estado: string; forma_cobro: 'ANTICIPADO' | 'AL_SALIR'; registro_tardio: boolean; registrada_por: string; registrada_en: string;
  huesped: { id: string; nombre_mostrado: string; tipo_documento: string | null; documento_enmascarado: string | null; nacionalidad: string | null; anonimizado: boolean };
  cargos: Cargo[]; pagos: Pago[]; cuenta: { total_cargos: number; pagado: number; por_verificar: number; saldo: number; a_favor: number; devuelto: number };
  /** TICKET-26: pedidos de lavandería recibidos sin entregar (aviso al dar salida). */
  lavanderia_por_entregar: number;
}
/** FR-32: productos vendidos por grupo y producto en un periodo o un turno. */
export interface InformeProductos {
  desde: string | null; hasta: string | null; turno_id: string | null; cantidad: number; valor: number;
  grupos: Array<{ grupo: string; cantidad: number; valor: number; productos: Array<{ nombre: string; cantidad: number; valor: number }> }>;
}
/** FR-31: titular de una habitación ocupada, con el documento completo (para la ronda de la policía). */
/** Datos para llenar el reporte del SIRE (TICKET-37); cada consulta queda en la auditoría. */
export interface DatosMigracion {
  habitacion_numero: string; nombre: string | null; tipo_documento: string | null; numero_documento: string | null; nacionalidad: string | null;
  entrada_en: string; salida_en: string | null; salida_prevista_en: string;
}
export interface TitularHoy { habitacion_numero: string; nombre: string; tipo_documento: string | null; numero_documento: string | null; entrada_en: string; salida_prevista_en: string }
/** Medios con los que se paga: el efectivo entra a la caja; las transferencias quedan por confirmar (RN-12). */
export type MedioPago = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA';
export type FormaPago = MedioPago | 'AL_SALIR';
export interface PedidoEntrada extends PedidoCotizacion {
  registro_tardio?: boolean;
  huesped: Record<string, unknown>;
  autorizacion: { otorgada: boolean; version_aviso: string };
  pago: { forma: FormaPago; valor_recibido?: number };
}

export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}): Promise<T> {
  const r = await fetch('/api/v1' + ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: { ...(cuerpo ? { 'content-type': 'application/json' } : {}), ...cabeceras },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (r.status === 204) return undefined as T;
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(r.status, datos.codigo ?? 'ERROR_INTERNO', datos.mensaje ?? 'No se pudo conectar con el sistema.');
  return datos as T;
}

export const api = {
  turnos: (desplazamiento = 0, limite = 20) => pedir<{ items: Turno[]; total: number }>('GET', `/turnos?limite=${limite}&desplazamiento=${desplazamiento}`),
  turno: (id: string) => pedir<TurnoDetalle>('GET', `/turnos/${id}`),
  productosVendidos: (q: { desde: string; hasta: string } | { turno_id: string }) =>
    pedir<InformeProductos>('GET', `/reportes/productos?${new URLSearchParams(q)}`),
  reporteDias: (desde: string, hasta: string) => pedir<{ items: ResumenDia[] }>('GET', `/reportes/dias?${new URLSearchParams({ desde, hasta })}`),
  iniciarSesion: (usuario: string, pin: string) => pedir<SesionActual>('POST', '/sesiones', { usuario, pin }),
  sesionActual: () => pedir<SesionActual>('GET', '/sesiones/actual'),
  cerrarSesion: () => pedir<void>('DELETE', '/sesiones/actual'),
  habitaciones: () => pedir<{ items: Habitacion[] }>('GET', '/habitaciones'),
  cotizar: (p: PedidoCotizacion) => pedir<Cotizacion>('POST', '/cotizaciones', p),
  /** La clave se genera una vez por asistente: si se toca dos veces o se reintenta, no se duplica la entrada. */
  registrarEntrada: (p: PedidoEntrada, clave: string) => pedir<Estadia>('POST', '/estadias', p, { 'idempotency-key': clave }),
  pagosPorConfirmar: () => pedir<{ items: Pago[] }>('GET', '/pagos?estado=POR_VERIFICAR'),
  verificarPago: (id: string, resultado: 'LLEGO' | 'NO_LLEGO', clave: string) =>
    pedir<Pago>('POST', `/pagos/${id}/verificacion`, { resultado }, { 'idempotency-key': clave }),
  estadia: (id: string) => pedir<Estadia>('GET', `/estadias/${id}`),
  productos: () => pedir<{ items: Producto[] }>('GET', '/productos'),
  agregarCargos: (id: string, items: Array<{ producto_id: string; cantidad: number }>, clave: string) =>
    pedir<Estadia>('POST', `/estadias/${id}/cargos`, { items }, { 'idempotency-key': clave }),
  registrarPago: (id: string, medio: MedioPago, valor: number, clave: string) =>
    pedir<Pago>('POST', `/estadias/${id}/pagos`, { medio, valor }, { 'idempotency-key': clave }),
  darSalida: (id: string) => pedir<Estadia>('POST', `/estadias/${id}/salida`),
  cambiarEstado: (numero: string, cuerpo: { estado: string; nota?: string; limpieza_especial?: boolean }) =>
    pedir<Habitacion>('PUT', `/habitaciones/${numero}/estado`, cuerpo),
  pagosDelTurno: (turnoId: string) => pedir<{ items: Pago[] }>('GET', `/pagos?turno_id=${turnoId}`),
  salidasDelTurno: (turnoId: string) => pedir<{ items: SalidaTurno[] }>('GET', `/movimientos_caja?turno_id=${turnoId}`),
  registrarSalida: (cuerpo: { tipo: TipoSalida; detalle: string; valor: number; habitacion_numero?: string }, clave: string) =>
    pedir<SalidaTurno>('POST', '/movimientos_caja', cuerpo, { 'idempotency-key': clave }),
  entregarTurno: (cuerpo: { pago_tomado: boolean; efectivo_contado: number; motivo_diferencia?: string }) =>
    pedir<Turno>('POST', '/turnos/actual/entrega', cuerpo),
  // TICKET-34 · quiénes se quedan hoy (queda en la auditoría).
  huespedesHoy: () => pedir<{ items: TitularHoy[] }>('GET', '/huespedes/hoy'),
  // TICKET-37 · reportes de extranjeros a Migración Colombia (el sistema no se conecta al SIRE).
  migracionPendientes: () => pedir<{ items: PendienteMigracion[] }>('GET', '/migracion/pendientes'),
  migracionDatos: (estadiaId: string) => pedir<DatosMigracion>('GET', `/migracion/datos/${estadiaId}`),
  reportarMigracion: (estadia_id: string, tipo: TipoReporte) => pedir<{ id: string }>('POST', '/migracion/reportes', { estadia_id, tipo }),
  // TICKET-27 · daños: solo la administración pone el valor.
  cobrarDano: (id: string, descripcion: string, valor: number) => pedir<Estadia>('POST', `/estadias/${id}/danos`, { descripcion, valor }),
  // TICKET-26 · cambio de habitación.
  cotizarCambio: (id: string, habitacion_numero: string) => pedir<CotizacionCambio>('POST', `/estadias/${id}/cambio-habitacion/cotizacion`, { habitacion_numero }),
  cambiarHabitacion: (id: string, habitacion_numero: string) => pedir<Estadia>('POST', `/estadias/${id}/cambio-habitacion`, { habitacion_numero }),
  cotizarExtension: (id: string, cuerpo: { modalidad: string; horas?: number }) =>
    pedir<CotizacionExtension>('POST', `/estadias/${id}/extensiones/cotizacion`, cuerpo),
  extender: (id: string, cuerpo: { modalidad: string; horas?: number }, clave: string) =>
    pedir<Estadia>('POST', `/estadias/${id}/extensiones`, cuerpo, { 'idempotency-key': clave }),
  desistir: (id: string, cuerpo: { motivo: 'SOLO_MIRO' | 'YA_USO'; medio: 'EFECTIVO' | 'TRANSFERENCIA' }, clave: string) =>
    pedir<{ id: string; valor: number; medio: string; movimiento_caja_id: string | null }>('POST', `/estadias/${id}/devoluciones`, cuerpo, { 'idempotency-key': clave }),
  anularPago: (id: string, motivo: string) => pedir<Pago>('POST', `/pagos/${id}/anulacion`, { motivo }),
  anularSalida: (id: string, motivo: string) => pedir<SalidaTurno>('POST', `/movimientos_caja/${id}/anulacion`, { motivo }),
  usuarios: () => pedir<{ items: UsuarioAdmin[] }>('GET', '/usuarios'),
  crearUsuario: (cuerpo: { nombre: string; usuario: string; rol: UsuarioAdmin['rol']; pin: string }) => pedir<UsuarioAdmin>('POST', '/usuarios', cuerpo),
  actualizarUsuario: (id: string, cuerpo: { activo?: boolean; pin?: string; desbloquear?: boolean }) => pedir<UsuarioAdmin>('PATCH', `/usuarios/${id}`, cuerpo),
  auditoria: (desplazamiento = 0, entidad = '', limite = 20) =>
    pedir<{ items: RegistroActividad[]; total: number }>('GET', `/auditoria?${new URLSearchParams({ limite: String(limite), desplazamiento: String(desplazamiento), ...(entidad ? { entidad } : {}) })}`),
  tarifas: () => pedir<{ items: Tarifa[] }>('GET', '/tarifas'),
  guardarTarifas: (items: TarifaInput[]) => pedir<{ items: Tarifa[] }>('PUT', '/tarifas', { items }),
  reglas: () => pedir<Reglas>('GET', '/reglas'),
  guardarReglas: (cambios: Partial<Reglas>) => pedir<Reglas>('PATCH', '/reglas', cambios),
  // TICKET-28 · datos del hotel para el aviso de privacidad (los escribe la administración).
  datosHotel: () => pedir<DatosHotel>('GET', '/hotel'),
  guardarDatosHotel: (d: Record<keyof DatosHotel, string>) => pedir<DatosHotel>('PUT', '/hotel', d),
  // TICKET-23 · lavandería.
  pedirLavanderia: (estadiaId: string, items: Array<{ producto_id: string; cantidad: number }>) =>
    pedir<PedidoLavanderia>('POST', `/estadias/${estadiaId}/lavanderia`, { items }),
  lavanderiaPorEntregar: () => pedir<{ items: PedidoLavanderia[] }>('GET', '/lavanderia?estado=RECIBIDO'),
  // TICKET-24 · externos: solo el nombre; pagan de una vez o al reclamar.
  lavanderiaExterna: (cliente_nombre: string, items: Array<{ producto_id: string; cantidad: number }>, cobro?: { medio: MedioPago }) =>
    pedir<PedidoLavanderia>('POST', '/lavanderia', { cliente_nombre, items, ...(cobro ? { cobro } : {}) }),
  deudasLavanderia: () => pedir<{ items: PedidoLavanderia[] }>('GET', '/lavanderia/deudas'),
  cobrarLavanderia: (id: string, medio: MedioPago) => pedir<PedidoLavanderia>('POST', `/lavanderia/${id}/cobro`, { medio }),
  entregarLavanderia: (id: string, cuerpo: { cobro?: { medio: MedioPago }; sin_pago_autorizado?: boolean }) =>
    pedir<PedidoLavanderia>('POST', `/lavanderia/${id}/entrega`, cuerpo),
  // TICKET-25 · solicitudes de factura: recepción las anota; la administración las avanza.
  solicitarFactura: (estadiaId: string, datos: SolicitudInput) => pedir<SolicitudFactura>('POST', `/estadias/${estadiaId}/solicitudes-factura`, datos),
  solicitudesFacturaDeEstadia: (estadiaId: string) => pedir<{ items: SolicitudFactura[] }>('GET', `/estadias/${estadiaId}/solicitudes-factura`),
  solicitudesFacturaAbiertas: () => pedir<{ items: SolicitudFactura[] }>('GET', '/solicitudes-factura?estado=PENDIENTE&estado=ENVIADA_AL_CONTADOR'),
  avanzarSolicitudFactura: (id: string, estado: EstadoFactura) => pedir<SolicitudFactura>('PATCH', `/solicitudes-factura/${id}`, { estado }),
  // TICKET-22 · venta de contado (sin habitación).
  venderContado: (items: Array<{ producto_id: string; cantidad: number }>, medio: MedioPago, clave: string) =>
    pedir<{ id: string; total: number; pago: Pago }>('POST', '/ventas', { items, medio }, { 'idempotency-key': clave }),
  // TICKET-21 · surtido y existencias (solo la administración).
  existencias: () => pedir<{ items: Existencia[] }>('GET', '/existencias'),
  registrarSurtido: (producto_id: string, cantidad: number) => pedir<{ id: string; cantidad: number }>('POST', '/surtidos', { producto_id, cantidad }),
  productosTodos: () => pedir<{ items: Producto[] }>('GET', '/productos?incluir_inactivos=true'),
  crearProducto: (p: Omit<Producto, 'id' | 'seccion'> & { seccion?: number }) => pedir<Producto>('POST', '/productos', p),
  guardarProducto: (id: string, p: Omit<Producto, 'id' | 'seccion'> & { seccion?: number }) => pedir<Producto>('PUT', `/productos/${id}`, p),
  turnoActual: () => pedir<Turno>('GET', '/turnos/actual'),
  recibirTurno: (base_contada: number, motivo_diferencia?: string) =>
    pedir<Turno>('POST', '/turnos/actual/recepcion', motivo_diferencia ? { base_contada, motivo_diferencia } : { base_contada }),
};
