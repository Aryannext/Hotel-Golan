import type { Producto, SalidaTurno, TipoSalida } from './logica.ts';

// Cliente de la API. La sesión viaja en la cookie HttpOnly; el navegador la envía sola (same-origin).
export interface Usuario { id: string; nombre: string; usuario: string; rol: 'RECEPCION' | 'ADMINISTRACION'; activo: boolean }
export interface SesionActual { usuario: Usuario; expira_en: string; turno_por_recibir: boolean }
export interface EstadiaResumen { id: string; nombre_corto: string; salida_prevista_en: string; saldo: number; por_verificar: number; vencida: boolean }
export interface Habitacion { numero: string; tipo: 'AIRE' | 'VENTILADOR'; estado: string; nota: string | null; estadia_activa: EstadiaResumen | null }

export interface Cotizacion {
  tarifa: number; descuento: number; total: number; salida_prevista_en: string; permite_pago_al_salir: boolean;
  franja_salida: 'MADRUGADA_MISMO_DIA' | 'VEINTICUATRO_HORAS' | 'MEDIODIA_SIGUIENTE' | 'TRES_HORAS';
}
export interface PedidoCotizacion { habitacion_numero: string; modalidad: 'NOCHE' | 'TRES_HORAS'; personas: number; noches: number; aplicar_descuento: boolean }

export interface ResumenCaja {
  base_recibida: number; efectivo: number; salidas: number; debe_haber: number;
  transferencias: number; por_verificar_cantidad: number; pago_turno: number;
}
export interface Turno {
  id: string; tipo: 'DIA' | 'NOCHE'; estado: 'POR_RECIBIR' | 'ABIERTO' | 'CERRADO'; responsable: string | null; recibido_de: string | null;
  inicio_en: string; fin_en: string | null; fin_programado_en: string; base_entregada: number; base_recibida: number | null; caja: ResumenCaja;
}

export interface Cargo { id: string; tipo: string; concepto: string; cantidad: number; valor_unitario: number; valor: number; creado_por: string; creado_en: string; anulado: boolean }
export interface Pago {
  id: string; estadia_id: string; habitacion_numero: string; turno_id: string; medio: 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA'; valor: number;
  estado: string; registrado_por: string; registrado_en: string; verificado_por: string | null; verificado_en: string | null; anulado: boolean;
}
export interface Estadia {
  id: string; habitacion_numero: string; modalidad: string; personas: number; noches: number; entrada_en: string; salida_prevista_en: string;
  estado: string; forma_cobro: 'ANTICIPADO' | 'AL_SALIR';
  huesped: { id: string; nombre_mostrado: string; tipo_documento: string | null; documento_enmascarado: string | null; nacionalidad: string | null; anonimizado: boolean };
  cargos: Cargo[]; pagos: Pago[]; cuenta: { total_cargos: number; pagado: number; por_verificar: number; saldo: number; a_favor: number };
}
export type FormaPago = 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA' | 'AL_SALIR';
export interface PedidoEntrada extends PedidoCotizacion {
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
  registrarPago: (id: string, medio: 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA', valor: number, clave: string) =>
    pedir<Pago>('POST', `/estadias/${id}/pagos`, { medio, valor }, { 'idempotency-key': clave }),
  darSalida: (id: string) => pedir<Estadia>('POST', `/estadias/${id}/salida`),
  cambiarEstado: (numero: string, cuerpo: { estado: string; nota?: string; limpieza_especial?: boolean }) =>
    pedir<Habitacion>('PUT', `/habitaciones/${numero}/estado`, cuerpo),
  pagosDelTurno: (turnoId: string) => pedir<{ items: Pago[] }>('GET', `/pagos?turno_id=${turnoId}`),
  salidasDelTurno: (turnoId: string) => pedir<{ items: SalidaTurno[] }>('GET', `/movimientos_caja?turno_id=${turnoId}`),
  registrarSalida: (cuerpo: { tipo: TipoSalida; detalle: string; valor: number; habitacion_numero?: string }, clave: string) =>
    pedir<SalidaTurno>('POST', '/movimientos_caja', cuerpo, { 'idempotency-key': clave }),
  turnoActual: () => pedir<Turno>('GET', '/turnos/actual'),
  recibirTurno: (base_contada: number, motivo_diferencia?: string) =>
    pedir<Turno>('POST', '/turnos/actual/recepcion', motivo_diferencia ? { base_contada, motivo_diferencia } : { base_contada }),
};
