// Solicitudes de factura (TICKET-25 y TICKET-33; FR-28, RN-23): recepción anota el RUT o NIT y el correo o el celular;
// la administración se los pasa al contador, que hace la factura en 1 a 3 días hábiles y se la devuelve. Ella, o
// recepción, se la envía al huésped por WhatsApp o correo. El sistema no hace facturas.

export type EstadoFactura = 'PENDIENTE' | 'ENVIADA_AL_CONTADOR' | 'ENTREGADA';
export interface SolicitudFactura {
  id: string; estadia_id: string; habitacion_numero: string; documento: string | null; correo: string | null; telefono: string | null;
  estado: EstadoFactura; fecha_prevista: string; fecha_prevista_hasta: string; registrada_por: string; registrada_en: string;
  enviada_por: string | null; enviada_en: string | null; entregada_por: string | null; entregada_en: string | null;
}
export interface FormFactura { documento: string; correo: string; telefono: string }
export interface SolicitudInput { documento: string; correo?: string; telefono?: string }

export const FACTURA_VACIA: FormFactura = { documento: '', correo: '', telefono: '' };

const sinEspacios = (s: string) => s.replaceAll(/[\s.]/g, '');
const digitos = (s: string) => s.replaceAll(/\D/g, '');
/** nombre@dominio.algo, sin espacios (sin expresiones con repeticiones anidadas). */
function correoValido(c: string): boolean {
  const [usuario, dominio, ...resto] = c.split('@');
  return !resto.length && !!usuario && !!dominio && !/\s/.test(c) && dominio.includes('.') && !dominio.startsWith('.') && !dominio.endsWith('.');
}

export function erroresFactura(f: FormFactura): Partial<Record<keyof FormFactura, string>> {
  const e: Partial<Record<keyof FormFactura, string>> = {};
  if (!/^\d{5,12}(-\d)?$/.test(sinEspacios(f.documento))) e.documento = 'Escriba el RUT o NIT con números; el dígito de verificación va después del guion.';
  const correo = f.correo.trim();
  const telefono = f.telefono.trim();
  if (correo && !correoValido(correo)) e.correo = 'Revise el correo: debe ser como nombre@correo.com.';
  if (telefono && !/^3\d{9}$/.test(digitos(telefono))) e.telefono = 'El celular tiene 10 números y empieza por 3.';
  if (!correo && !telefono) e.correo = 'Escriba el correo o el celular: por ahí le llega la factura.';
  return e;
}

export function aSolicitudInput(f: FormFactura): SolicitudInput {
  const correo = f.correo.trim();
  const telefono = digitos(f.telefono);
  return { documento: sinEspacios(f.documento), ...(correo ? { correo } : {}), ...(telefono ? { telefono: '+57' + telefono } : {}) };
}

const ESTADOS: Record<EstadoFactura, [string, string]> = {
  PENDIENTE: ['pill--aviso', 'Por pasar al contador'],
  ENVIADA_AL_CONTADOR: ['pill--info', 'Con el contador'],
  ENTREGADA: ['pill--exito', 'Entregada'],
};
export const estadoFactura = (estado: EstadoFactura) => ESTADOS[estado];

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** «lunes 19 de octubre» a partir de AAAA-MM-DD (sin depender de la zona horaria del equipo). */
export function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** «entre el lunes 19 y el miércoles 21 de octubre»; si cambia de mes, cada fecha con su mes. */
export function textoPrevista(desde: string, hasta: string): string {
  const [d, h] = [fechaLarga(desde), fechaLarga(hasta)];
  return desde.slice(0, 7) === hasta.slice(0, 7) ? `entre el ${d.replace(/ de \S+$/, '')} y el ${h}` : `entre el ${d} y el ${h}`;
}

const PASOS: Partial<Record<EstadoFactura, { estado: EstadoFactura; texto: string }>> = {
  PENDIENTE: { estado: 'ENVIADA_AL_CONTADOR', texto: 'Ya se la pasé al contador' },
  ENVIADA_AL_CONTADOR: { estado: 'ENTREGADA', texto: 'Ya se la envié al huésped' },
};
export const siguientePaso = (estado: EstadoFactura) => PASOS[estado] ?? null;
