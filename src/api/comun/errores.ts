// Errores de la API con código estable y mensaje en español sencillo (CONTRATO_API.yaml, schema Error).
export type CodigoError =
  | 'INVALID_PAYLOAD' | 'NO_AUTENTICADO' | 'CREDENCIALES_INVALIDAS' | 'USUARIO_BLOQUEADO' | 'SIN_PERMISO'
  | 'NO_ENCONTRADO' | 'CONFLICTO' | 'ERROR_INTERNO' | 'CAPACIDAD_EXCEDIDA' | 'DESCUENTO_NO_PERMITIDO'
  | 'SIN_TURNO_ABIERTO' | 'MOTIVO_REQUERIDO' | 'AUTORIZACION_REQUERIDA' | 'HABITACION_NO_DISPONIBLE' | 'PAGO_AL_SALIR_NO_PERMITIDO'
  | 'SALDO_PENDIENTE' | 'TRANSICION_INVALIDA' | 'PAGO_SIN_VERIFICAR' | 'SIN_EXISTENCIAS' | 'NO_VENDIBLE' | 'PAGO_REQUERIDO'
  | 'DESCUENTO_EXCEDE_MAXIMO';

export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: CodigoError;
  constructor(estado: number, codigo: CodigoError, mensaje: string) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

export const noAutenticado = () => new ErrorApi(401, 'NO_AUTENTICADO', 'Su sesión no es válida o ya venció. Inicie sesión de nuevo.');
export const sinPermiso = () => new ErrorApi(403, 'SIN_PERMISO', 'Su usuario no tiene permiso para esta acción.');
