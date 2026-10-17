// Usuarios (FR-18, ADR-003): la administración crea, desactiva o reactiva, cambia el PIN y desbloquea.
// El PIN se guarda con Argon2id y nunca sale de aquí ni llega a la auditoría.
import { hash } from '@node-rs/argon2';
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { auditar } from '../comun/auditoria.ts';
import { ErrorApi } from '../comun/errores.ts';
import { aBogota } from '../comun/tiempo.ts';
import { requiere, type Rol } from './sesiones.ts';

const UNICO_VIOLADO = '23505';
const PIN = { type: 'string', pattern: '^[0-9]{6}$' };
const ROL = { type: 'string', enum: ['RECEPCION', 'ADMINISTRACION'] };

interface FilaUsuario { id: string; nombre: string; usuario: string; rol: Rol; activo: boolean; bloqueado_hasta: Date | null }
interface CuerpoCrear { nombre: string; usuario: string; rol: Rol; pin: string }
interface CuerpoCambio { activo?: boolean; pin?: string; desbloquear?: boolean }

const SELECT_USUARIO = 'SELECT id, nombre, usuario, rol, activo, bloqueado_hasta FROM usuarios';

/** Solo se informa el bloqueo mientras sigue vigente: uno vencido ya no impide entrar. */
const respuesta = (u: FilaUsuario, ahora: Date) => ({
  id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: u.activo,
  bloqueado_hasta: u.bloqueado_hasta && new Date(u.bloqueado_hasta) > ahora ? aBogota(new Date(u.bloqueado_hasta)) : null,
});

export function rutasUsuarios(app: FastifyInstance, bd: Bd, ahora: () => Date) {
  const soloAdministracion = requiere(bd, ahora, ['ADMINISTRACION']);

  app.get('/usuarios', { preHandler: soloAdministracion }, async () => {
    const filas = await bd.consultar<FilaUsuario>(`${SELECT_USUARIO} ORDER BY activo DESC, rol DESC, usuario`);
    const momento = ahora();
    return { items: filas.map((u) => respuesta(u, momento)) };
  });

  app.post<{ Body: CuerpoCrear }>('/usuarios', {
    preHandler: soloAdministracion,
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['nombre', 'usuario', 'rol', 'pin'],
      properties: { nombre: { type: 'string', minLength: 2, maxLength: 80 }, usuario: { type: 'string', pattern: '^[a-z0-9._-]{3,40}$' }, rol: ROL, pin: PIN },
    } },
  }, async (req, rep) => {
    const b = req.body;
    const nombre = b.nombre.trim();
    if (nombre.length < 2) throw new ErrorApi(400, 'INVALID_PAYLOAD', 'Escriba el nombre de la persona.');
    const pinHash = await hash(b.pin);
    const momento = ahora();
    const u = await bd.transaccion(async (tx) => {
      let fila: FilaUsuario;
      try {
        [fila] = await tx.consultar<FilaUsuario>(
          'INSERT INTO usuarios (nombre, usuario, pin_hash, rol, creado_en) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, usuario, rol, activo, bloqueado_hasta',
          [nombre, b.usuario, pinHash, b.rol, momento]);
      } catch (error) {
        if ((error as { code?: string }).code === UNICO_VIOLADO) throw new ErrorApi(409, 'CONFLICTO', `Ya existe el usuario «${b.usuario}». Elija otro.`);
        throw error;
      }
      await auditar(tx, { usuarioId: req.usuario!.id, accion: 'CREAR', entidad: 'usuarios', entidadId: fila.id, detalle: { rol: b.rol }, ocurrido: momento });
      return fila;
    });
    return rep.code(201).send(respuesta(u, momento));
  });

  app.patch<{ Params: { id: string }; Body: CuerpoCambio }>('/usuarios/:id', {
    preHandler: soloAdministracion,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      body: { type: 'object', additionalProperties: false, minProperties: 1, properties: { activo: { type: 'boolean' }, pin: PIN, desbloquear: { type: 'boolean' } } },
    },
  }, async (req) => {
    const { id } = req.params;
    const b = req.body;
    const yo = req.usuario!;
    // Sin esto, la administración podría dejar el hotel sin nadie que administre. [P]
    if (b.activo === false && id === yo.id) throw new ErrorApi(409, 'CONFLICTO', 'No puede desactivar su propio usuario.');
    const pinHash = b.pin ? await hash(b.pin) : null;
    const momento = ahora();
    const u = await bd.transaccion(async (tx) => {
      const [actual] = await tx.consultar<FilaUsuario>(`${SELECT_USUARIO} WHERE id = $1 FOR UPDATE`, [id]);
      if (!actual) throw new ErrorApi(404, 'NO_ENCONTRADO', 'El usuario no existe.');
      const detalle: Record<string, string> = {};
      if (b.activo !== undefined && b.activo !== actual.activo) {
        await tx.consultar('UPDATE usuarios SET activo = $2 WHERE id = $1', [id, b.activo]);
        detalle.activo = b.activo ? 'si' : 'no';
        // Desactivar cierra todas sus sesiones: deja de poder usar el sistema en ese mismo momento.
        if (!b.activo) await tx.consultar('UPDATE sesiones SET revocada_en = $2 WHERE usuario_id = $1 AND revocada_en IS NULL', [id, momento]);
      }
      if (pinHash) {
        await tx.consultar('UPDATE usuarios SET pin_hash = $2, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [id, pinHash]);
        // Un PIN nuevo cierra las sesiones abiertas con el anterior (salvo la de quien lo cambia). [P]
        await tx.consultar('UPDATE sesiones SET revocada_en = $2 WHERE usuario_id = $1 AND revocada_en IS NULL AND id <> $3', [id, momento, yo.sesionId]);
        detalle.pin = 'cambiado';
      }
      if (b.desbloquear && !pinHash) {
        await tx.consultar('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1', [id]);
        detalle.desbloqueo = 'si';
      }
      if (Object.keys(detalle).length > 0) {
        await auditar(tx, { usuarioId: yo.id, accion: 'ACTUALIZAR', entidad: 'usuarios', entidadId: id, detalle, ocurrido: momento });
      }
      const [fila] = await tx.consultar<FilaUsuario>(`${SELECT_USUARIO} WHERE id = $1`, [id]);
      return fila;
    });
    return respuesta(u, momento);
  });
}
