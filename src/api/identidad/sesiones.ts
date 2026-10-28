// Identidad: inicio de sesión con usuario + PIN de 6 dígitos, bloqueo y sesiones (FR-19, ADR-003).
import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { auditar } from '../comun/auditoria.ts';
import { ErrorApi, noAutenticado, sinPermiso } from '../comun/errores.ts';
import { aBogota } from '../comun/tiempo.ts';

export type Rol = 'RECEPCION' | 'ADMINISTRACION';
export interface UsuarioSesion { id: string; nombre: string; usuario: string; rol: Rol; activo: boolean; sesionId: string; expira: Date }

export const COOKIE = 'sesion';
export const DURACION_SESION_MS = 12 * 3_600_000;
const INTENTOS_MAXIMOS = 5;
const BLOQUEO_MS = 15 * 60_000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
// Hash de relleno: con un usuario inexistente se verifica igual, para no revelar por el tiempo de respuesta si existe.
let hashRelleno: Promise<string> | undefined;
const relleno = () => (hashRelleno ??= hash('000000'));

const credencialesInvalidas = () =>
  new ErrorApi(401, 'CREDENCIALES_INVALIDAS', 'El usuario o el PIN no son correctos.');

function bloqueado(hasta: Date, ahora: Date) {
  const minutos = Math.max(1, Math.ceil((new Date(hasta).getTime() - ahora.getTime()) / 60_000));
  return new ErrorApi(423, 'USUARIO_BLOQUEADO', `Usuario bloqueado por intentos fallidos. Intente de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`);
}

interface FilaUsuario { id: string; nombre: string; usuario: string; rol: Rol; activo: boolean; pin_hash: string; intentos_fallidos: number; bloqueado_hasta: Date | null }

export async function iniciarSesion(bd: Bd, ahora: Date, usuario: string, pin: string) {
  const [u] = await bd.consultar<FilaUsuario>(
    'SELECT id, nombre, usuario, rol, activo, pin_hash, intentos_fallidos, bloqueado_hasta FROM usuarios WHERE usuario = $1',
    [usuario]);
  if (!u?.activo) {
    await verify(await relleno(), pin);
    throw credencialesInvalidas();
  }
  if (u.bloqueado_hasta && new Date(u.bloqueado_hasta) > ahora) throw bloqueado(u.bloqueado_hasta, ahora);
  // El intento se reserva antes de verificar, en una sola sentencia (HAL-10): aunque lleguen muchos en paralelo,
  // nunca se verifican más de INTENTOS_MAXIMOS PIN por bloqueo. Si se acabaron, el usuario queda bloqueado.
  const [reserva] = await bd.consultar<{ intentos_fallidos: number }>(
    `UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1
      WHERE id = $1 AND intentos_fallidos < $2 AND (bloqueado_hasta IS NULL OR bloqueado_hasta <= $3)
      RETURNING intentos_fallidos`, [u.id, INTENTOS_MAXIMOS, ahora]);
  if (!reserva) throw bloqueado(new Date(ahora.getTime() + BLOQUEO_MS), ahora);
  if (!(await verify(u.pin_hash, pin))) {
    if (reserva.intentos_fallidos >= INTENTOS_MAXIMOS) {
      await bd.consultar('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = $2 WHERE id = $1',
        [u.id, new Date(ahora.getTime() + BLOQUEO_MS)]);
      await auditar(bd, { usuarioId: u.id, accion: 'BLOQUEAR', entidad: 'usuarios', entidadId: u.id, ocurrido: ahora });
    }
    throw credencialesInvalidas();
  }

  const token = randomBytes(32).toString('base64url');
  const expira = new Date(ahora.getTime() + DURACION_SESION_MS);
  const sesion = await bd.transaccion(async (tx) => {
    await tx.consultar('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [u.id]);
    const [s] = await tx.consultar<{ id: string }>(
      'INSERT INTO sesiones (usuario_id, token_hash, creada_en, expira_en) VALUES ($1, $2, $3, $4) RETURNING id',
      [u.id, hashToken(token), ahora, expira]);
    await auditar(tx, { usuarioId: u.id, accion: 'INICIAR_SESION', entidad: 'sesiones', entidadId: s.id, ocurrido: ahora });
    return s;
  });
  const usuarioSesion: UsuarioSesion = { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: u.activo, sesionId: sesion.id, expira };
  return { token, usuario: usuarioSesion };
}

export async function usuarioDeToken(bd: Bd, ahora: Date, token: string | undefined): Promise<UsuarioSesion | null> {
  if (!token) return null;
  const [f] = await bd.consultar<{ id: string; nombre: string; usuario: string; rol: Rol; activo: boolean; sesion_id: string; expira_en: Date }>(
    `SELECT u.id, u.nombre, u.usuario, u.rol, u.activo, s.id AS sesion_id, s.expira_en
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1 AND s.revocada_en IS NULL AND s.expira_en > $2 AND u.activo`,
    [hashToken(token), ahora]);
  return f ? { id: f.id, nombre: f.nombre, usuario: f.usuario, rol: f.rol, activo: f.activo, sesionId: f.sesion_id, expira: new Date(f.expira_en) } : null;
}

export async function cerrarSesion(bd: Bd, ahora: Date, u: UsuarioSesion): Promise<void> {
  await bd.consultar('UPDATE sesiones SET revocada_en = $2 WHERE id = $1', [u.sesionId, ahora]);
  await auditar(bd, { usuarioId: u.id, accion: 'CERRAR_SESION', entidad: 'sesiones', entidadId: u.sesionId, ocurrido: ahora });
}

export async function sesionActual(bd: Bd, u: UsuarioSesion) {
  const [t] = await bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM turnos WHERE estado = 'POR_RECIBIR'`);
  return {
    usuario: { id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: u.activo },
    expira_en: aBogota(u.expira),
    turno_por_recibir: u.rol === 'RECEPCION' && t.n > 0,
  };
}

/** preHandler: exige sesión válida y uno de los roles. El rol se verifica siempre en el servidor (x-roles). */
export function requiere(bd: Bd, ahora: () => Date, roles: Rol[]) {
  return async (req: FastifyRequest, _rep: FastifyReply) => {
    const u = await usuarioDeToken(bd, ahora(), req.cookies[COOKIE]);
    if (!u) throw noAutenticado();
    if (!roles.includes(u.rol)) throw sinPermiso();
    req.usuario = u;
  };
}

declare module 'fastify' {
  interface FastifyRequest { usuario?: UsuarioSesion }
}
