// Presentación de usuarios y actividad (TICKET-14, FR-18 y FR-20). Sin JSX, se prueba con node --test.
import type { Usuario } from './api.ts';
import { horaBogota, pesos, textoEstado, textoMedio } from './logica.ts';
import { etiquetaTarifa, textoRegla, type Tarifa } from './ajustes.ts';

export interface UsuarioAdmin extends Usuario { bloqueado_hasta: string | null }
export interface RegistroActividad {
  id: number; usuario: string | null; accion: string; entidad: string; entidad_id: string; ocurrido_en: string; detalle: Record<string, string>;
}
export interface FormUsuario { nombre: string; usuario: string; pin: string; confirmar: string }

const limpiar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** «Laura Gómez» → «laura.gomez»; con dos nombres y dos apellidos se usa el primer apellido. Se puede corregir a mano. */
export function sugerirUsuario(nombre: string): string {
  const p = nombre.trim().split(/\s+/).map(limpiar).filter(Boolean);
  if (p.length === 0) return '';
  let sugerido = p[0];
  if (p.length > 1) {
    const apellido = p.length >= 4 ? p[2] : p[1];
    sugerido = `${p[0]}.${apellido}`;
  }
  return sugerido.length >= 3 ? sugerido.slice(0, 40) : '';
}

export function erroresUsuarioNuevo(f: FormUsuario): Partial<Record<keyof FormUsuario, string>> {
  const e: Partial<Record<keyof FormUsuario, string>> = {};
  if (f.nombre.trim().length < 2) e.nombre = 'Escriba el nombre de la persona.';
  if (!/^[a-z0-9._-]{3,40}$/.test(f.usuario)) e.usuario = 'Use de 3 a 40 letras minúsculas o números, sin espacios ni tildes (puede usar punto).';
  if (!/^\d{6}$/.test(f.pin)) e.pin = 'El PIN debe tener 6 números.';
  if (!f.confirmar) e.confirmar = 'Escriba otra vez el PIN.';
  else if (f.confirmar !== f.pin) e.confirmar = 'Los dos PIN no coinciden.';
  return e;
}

export function estadoUsuario(u: UsuarioAdmin): { tono: 'exito' | 'neutro' | 'alerta'; texto: string } {
  if (!u.activo) return { tono: 'neutro', texto: 'Desactivado' };
  if (u.bloqueado_hasta) return { tono: 'alerta', texto: `Bloqueado hasta las ${horaBogota(u.bloqueado_hasta)}` };
  return { tono: 'exito', texto: 'Activo' };
}

const valor = (d: Record<string, string>, clave = 'valor') => pesos(Number(d[clave] ?? 0));

function textoEntrega(d: Record<string, string>): string {
  const dif = Number(d.diferencia ?? 0);
  let extra = '';
  if (dif < 0) extra = ` (faltaron ${pesos(-dif)})`;
  else if (dif > 0) extra = ` (sobraron ${pesos(dif)})`;
  return `Entregó el turno con ${valor(d, 'contado')}${extra}`;
}

function textoCambioUsuario(d: Record<string, string>, a: string): string {
  if (d.activo === 'no') return `Desactivó a ${a}`;
  if (d.activo === 'si') return `Reactivó a ${a}`;
  if (d.pin) return `Cambió el PIN de ${a}`;
  return `Desbloqueó a ${a}`;
}

function textoProducto(d: Record<string, string>): string {
  if (d.activo === 'no') return 'Quitó un producto del catálogo';
  if (d.activo === 'si') return 'Volvió a poner un producto en el catálogo';
  if (d.precio && Object.keys(d).length === 1) return `Cambió el precio de un producto a ${valor(d, 'precio')}`;
  return d.nombre ? `Cambió el producto «${d.nombre}» del catálogo` : 'Cambió un producto del catálogo';
}

/** «AIRE NOCHE 1» → «Aire · noche · 1 persona a $65.000». */
function textoTarifas(d: Record<string, string>): string {
  return 'Cambió la tarifa ' + Object.entries(d).map(([clave, v]) => {
    const [tipo_habitacion, modalidad, personas] = clave.split(' ');
    return `${etiquetaTarifa({ tipo_habitacion, modalidad, personas: Number(personas) } as Pick<Tarifa, 'tipo_habitacion' | 'modalidad' | 'personas'>)} a ${pesos(Number(v))}`;
  }).join('; ');
}

type Frase = (d: Record<string, string>, r: RegistroActividad, quien: string | undefined) => string;

const FRASES: Record<string, Frase> = {
  'INICIAR_SESION sesiones': () => 'Entró al sistema',
  'CERRAR_SESION sesiones': () => 'Cerró sesión',
  'BLOQUEAR usuarios': (_d, _r, q) => `Se bloqueó a ${q ?? 'un usuario'} por 5 PIN equivocados`,
  'RECIBIR_TURNO turnos': (d) => `Recibió el turno con ${valor(d, 'base_contada')}`,
  'ENTREGAR_TURNO turnos': textoEntrega,
  'CREAR estadias': (d) => `Registró una entrada en la habitación ${d.habitacion} por ${valor(d, 'total')}`,
  'CREAR pagos': (d) => `Registró un cobro de ${valor(d)} por ${textoMedio(d.medio)}`,
  'VERIFICAR pagos': (d) => d.resultado === 'LLEGO' ? 'Confirmó que llegó una transferencia' : 'Marcó que no llegó una transferencia',
  'CREAR cargos': (d) => `Agregó un consumo o cargo de ${valor(d)}`,
  'CREAR movimientos_caja': (d) => `Sacó ${valor(d)} de la caja`,
  'CREAR devoluciones': (d) => `Devolvió ${valor(d)} a un huésped que desistió`,
  'ACTUALIZAR estadias': (d) => {
    if (d.accion === 'EXTENSION') return `Extendió una estadía por ${valor(d)}`;
    if (d.accion === 'CAMBIO_HABITACION') return `Cambió la habitación ${d.de} a la ${d.a}`;
    return 'Dio salida a una habitación';
  },
  'ACTUALIZAR habitaciones': (d, r) => `Pasó la habitación ${r.entidad_id} de ${textoEstado(d.de)} a ${textoEstado(d.a)}`,
  'ANULAR pagos': (d) => `Anuló un cobro de ${valor(d)}`,
  'ANULAR movimientos_caja': (d) => `Anuló una salida de dinero de ${valor(d)}`,
  'CREAR usuarios': (d, _r, q) => `Creó el usuario ${q ?? 'nuevo'} (${d.rol === 'ADMINISTRACION' ? 'administración' : 'recepción'})`,
  'ACTUALIZAR usuarios': (d, _r, q) => textoCambioUsuario(d, q ?? 'un usuario'),
  'ANONIMIZAR huespedes': (d) => {
    if (!d.cantidad) return 'Borró los datos de huéspedes vencidos';
    const n = Number(d.cantidad);
    return `Borró los datos personales de ${n} huésped${n === 1 ? '' : 'es'} (plazo de retención cumplido)`;
  },
  'ACTUALIZAR tarifas': textoTarifas,
  'ACTUALIZAR reglas': (d) => 'Cambió ' + Object.entries(d).map(([k, v]) => textoRegla(k, Number(v))).join('; '),
  'CREAR productos': (d) => `Agregó un producto de ${valor(d, 'precio')} al catálogo`,
  'ACTUALIZAR productos': textoProducto,
  'CREAR solicitudes_factura': () => 'Anotó una solicitud de factura',
  'ACTUALIZAR solicitudes_factura': (d) => d.estado === 'ENTREGADA' ? 'Marcó una factura como entregada al huésped' : 'Pasó una solicitud de factura al contador',
  'ANONIMIZAR solicitudes_factura': (d) => {
    const n = Number(d.cantidad ?? 0);
    return `Borró los datos de ${n} solicitud${n === 1 ? '' : 'es'} de factura (plazo de retención cumplido)`;
  },
};

const VERBOS: Record<string, string> = { CREAR: 'Creó', ACTUALIZAR: 'Cambió', ANULAR: 'Anuló' };

/** Una frase sencilla por registro de auditoría. `nombres` traduce el id de un usuario a su nombre de usuario. */
export function textoActividad(r: RegistroActividad, nombres: Record<string, string>): string {
  const frase = FRASES[`${r.accion} ${r.entidad}`];
  if (frase) return frase(r.detalle ?? {}, r, nombres[r.entidad_id]);
  return `${VERBOS[r.accion] ?? r.accion}: ${r.entidad}`;
}
