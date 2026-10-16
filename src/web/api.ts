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

export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch('/api/v1' + ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: cuerpo ? { 'content-type': 'application/json' } : {},
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
  turnoActual: () => pedir<Turno>('GET', '/turnos/actual'),
  recibirTurno: (base_contada: number, motivo_diferencia?: string) =>
    pedir<Turno>('POST', '/turnos/actual/recepcion', motivo_diferencia ? { base_contada, motivo_diferencia } : { base_contada }),
};
