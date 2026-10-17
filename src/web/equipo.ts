// Presentación de usuarios y actividad (TICKET-14, FR-18 y FR-20). Sin JSX, se prueba con node --test.
import type { Usuario } from './api.ts';
import { horaBogota, pesos, textoEstado, textoMedio } from './logica.ts';

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
  const sugerido = p.length === 1 ? p[0] : `${p[0]}.${p[p.length >= 4 ? 2 : 1]}`;
  return sugerido.length >= 3 ? sugerido.slice(0, 40) : '';
}

export function erroresUsuarioNuevo(f: FormUsuario): Partial<Record<keyof FormUsuario, string>> {
  const e: Partial<Record<keyof FormUsuario, string>> = {};
  if (f.nombre.trim().length < 2) e.nombre = 'Escriba el nombre de la persona.';
  if (!/^[a-z0-9._-]{3,40}$/.test(f.usuario)) e.usuario = 'Use de 3 a 40 letras minúsculas o números, sin espacios ni tildes (puede usar punto).';
  if (!/^[0-9]{6}$/.test(f.pin)) e.pin = 'El PIN debe tener 6 números.';
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

/** Una frase sencilla por registro de auditoría. `nombres` traduce el id de un usuario a su nombre de usuario. */
export function textoActividad(r: RegistroActividad, nombres: Record<string, string>): string {
  const d = r.detalle ?? {};
  const quien = nombres[r.entidad_id];
  const a = quien ?? 'un usuario';
  switch (`${r.accion} ${r.entidad}`) {
    case 'INICIAR_SESION sesiones': return 'Entró al sistema';
    case 'CERRAR_SESION sesiones': return 'Cerró sesión';
    case 'BLOQUEAR usuarios': return `Se bloqueó a ${a} por 5 PIN equivocados`;
    case 'RECIBIR_TURNO turnos': return `Recibió el turno con ${valor(d, 'base_contada')}`;
    case 'ENTREGAR_TURNO turnos': {
      const dif = Number(d.diferencia ?? 0);
      const extra = dif < 0 ? ` (faltaron ${pesos(-dif)})` : dif > 0 ? ` (sobraron ${pesos(dif)})` : '';
      return `Entregó el turno con ${valor(d, 'contado')}${extra}`;
    }
    case 'CREAR estadias': return `Registró una entrada en la habitación ${d.habitacion} por ${valor(d, 'total')}`;
    case 'CREAR pagos': return `Registró un cobro de ${valor(d)} por ${textoMedio(d.medio)}`;
    case 'VERIFICAR pagos': return d.resultado === 'LLEGO' ? 'Confirmó que llegó una transferencia' : 'Marcó que no llegó una transferencia';
    case 'CREAR cargos': return `Agregó un consumo o cargo de ${valor(d)}`;
    case 'CREAR movimientos_caja': return `Sacó ${valor(d)} de la caja`;
    case 'CREAR devoluciones': return `Devolvió ${valor(d)} a un huésped que desistió`;
    case 'ACTUALIZAR estadias': return d.accion === 'EXTENSION' ? `Extendió una estadía por ${valor(d)}` : 'Dio salida a una habitación';
    case 'ACTUALIZAR habitaciones': return `Pasó la habitación ${r.entidad_id} de ${textoEstado(d.de)} a ${textoEstado(d.a)}`;
    case 'ANULAR pagos': return `Anuló un cobro de ${valor(d)}`;
    case 'ANULAR movimientos_caja': return `Anuló una salida de dinero de ${valor(d)}`;
    case 'CREAR usuarios': return `Creó el usuario ${quien ?? 'nuevo'} (${d.rol === 'ADMINISTRACION' ? 'administración' : 'recepción'})`;
    case 'ACTUALIZAR usuarios':
      if (d.activo === 'no') return `Desactivó a ${a}`;
      if (d.activo === 'si') return `Reactivó a ${a}`;
      if (d.pin) return `Cambió el PIN de ${a}`;
      return `Desbloqueó a ${a}`;
    case 'ANONIMIZAR huespedes': return 'Borró los datos de huéspedes vencidos';
    default: return `${({ CREAR: 'Creó', ACTUALIZAR: 'Cambió', ANULAR: 'Anuló' } as Record<string, string>)[r.accion] ?? r.accion}: ${r.entidad}`;
  }
}
