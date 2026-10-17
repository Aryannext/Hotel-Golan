// TICKET-14 · GET/POST /usuarios, PATCH /usuarios/{id} y GET /auditoria (FR-18, FR-20; ADR-003) según docs/CONTRATO_API.yaml.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, PIN_PRUEBA, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let admin: string;
let recepcion: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T07:00:00-05:00');
  admin = await e.entrar('admin');
  recepcion = await e.entrar('recepcion1');
});
after(async () => e.cerrar());

const pedir = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown, cookie = admin) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie } });
const entrarCon = (usuario: string, pin: string) => e.app.inject({ method: 'POST', url: '/api/v1/sesiones', payload: { usuario, pin } });
const idDe = async (usuario: string) => (await e.bd.consultar<{ id: string }>('SELECT id FROM usuarios WHERE usuario = $1', [usuario]))[0].id;
const sesionVale = async (cookie: string) => (await e.app.inject({ method: 'GET', url: '/api/v1/sesiones/actual', headers: { cookie } })).statusCode;

describe('FR-18 — Usuarios (solo la administración)', () => {
  it('recepción no gestiona usuarios ni ve la auditoría: 403 SIN_PERMISO', async () => {
    const id = await idDe('recepcion2');
    for (const r of [
      await pedir('GET', '/usuarios', undefined, recepcion),
      await pedir('POST', '/usuarios', { nombre: 'Recepción Prueba 9', usuario: 'recepcion9', rol: 'RECEPCION', pin: '246813' }, recepcion),
      await pedir('PATCH', `/usuarios/${id}`, { activo: false }, recepcion),
      await pedir('GET', '/auditoria', undefined, recepcion),
    ]) {
      assert.equal(r.statusCode, 403);
      assert.equal(r.json().codigo, 'SIN_PERMISO');
    }
  });

  it('lista los usuarios con su rol y estado, sin el PIN', async () => {
    const r = await pedir('GET', '/usuarios');
    assert.equal(r.statusCode, 200);
    const items = r.json().items as Array<Record<string, unknown>>;
    assert.equal(items.length, 6);
    const a = items.find((u) => u.usuario === 'admin')!;
    assert.deepEqual(Object.keys(a).sort(), ['activo', 'bloqueado_hasta', 'id', 'nombre', 'rol', 'usuario']);
    assert.deepEqual([a.rol, a.activo, a.bloqueado_hasta], ['ADMINISTRACION', true, null]);
    assert.ok(!r.body.includes('argon2') && !r.body.includes('pin'));
  });

  it('crear un usuario: 201, el PIN se guarda con Argon2id y la persona ya puede entrar', async () => {
    const r = await pedir('POST', '/usuarios', { nombre: 'Recepción Prueba 5', usuario: 'recepcion5', rol: 'RECEPCION', pin: '246813' });
    assert.equal(r.statusCode, 201);
    const u = r.json();
    assert.deepEqual([u.nombre, u.usuario, u.rol, u.activo, u.bloqueado_hasta], ['Recepción Prueba 5', 'recepcion5', 'RECEPCION', true, null]);
    const [f] = await e.bd.consultar<{ pin_hash: string }>('SELECT pin_hash FROM usuarios WHERE id = $1', [u.id]);
    assert.match(f.pin_hash, /^\$argon2id\$/);
    assert.equal((await entrarCon('recepcion5', '246813')).statusCode, 201);
    const [a] = await e.bd.consultar<{ usuario: string; detalle: Record<string, string> }>(
      `SELECT u.usuario, a.detalle FROM auditoria a JOIN usuarios u ON u.id = a.usuario_id WHERE a.accion = 'CREAR' AND a.entidad = 'usuarios' AND a.entidad_id = $1`, [u.id]);
    assert.equal(a.usuario, 'admin');
    assert.deepEqual(a.detalle, { rol: 'RECEPCION' });
  });

  it('usuario repetido: 409 CONFLICTO; PIN que no es de 6 dígitos o campos de más: 400', async () => {
    const repetido = await pedir('POST', '/usuarios', { nombre: 'Otra Prueba', usuario: 'recepcion1', rol: 'RECEPCION', pin: '246813' });
    assert.equal(repetido.statusCode, 409);
    assert.equal(repetido.json().codigo, 'CONFLICTO');
    assert.equal((await pedir('POST', '/usuarios', { nombre: 'Otra Prueba', usuario: 'otra.prueba', rol: 'RECEPCION', pin: '12345' })).statusCode, 400);
    assert.equal((await pedir('POST', '/usuarios', { nombre: 'Otra Prueba', usuario: 'otra.prueba', rol: 'DUENA', pin: '123456' })).statusCode, 400);
    assert.equal((await pedir('POST', '/usuarios', { nombre: 'Otra Prueba', usuario: 'otra.prueba', rol: 'RECEPCION', pin: '123456', activo: false })).statusCode, 400);
  });

  it('Escenario «Usuario desactivado»: no puede entrar y sus sesiones anteriores quedan revocadas', async () => {
    const c1 = await e.entrar('recepcion3');
    const c2 = await e.entrar('recepcion3');
    const id = await idDe('recepcion3');
    const r = await pedir('PATCH', `/usuarios/${id}`, { activo: false });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().activo, false);
    assert.deepEqual([await sesionVale(c1), await sesionVale(c2)], [401, 401]);
    const [s] = await e.bd.consultar<{ vivas: number }>('SELECT count(*)::int AS vivas FROM sesiones WHERE usuario_id = $1 AND revocada_en IS NULL', [id]);
    assert.equal(s.vivas, 0);
    assert.equal((await entrarCon('recepcion3', PIN_PRUEBA)).statusCode, 401);
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'ACTUALIZAR' AND entidad = 'usuarios' AND entidad_id = $1`, [id]);
    assert.deepEqual(a.detalle, { activo: 'no' });
  });

  it('reactivar: la persona vuelve a entrar con su PIN', async () => {
    const id = await idDe('recepcion3');
    assert.equal((await pedir('PATCH', `/usuarios/${id}`, { activo: true })).json().activo, true);
    assert.equal((await entrarCon('recepcion3', PIN_PRUEBA)).statusCode, 201);
  });

  it('cambiar el PIN: el anterior deja de servir, el nuevo queda en Argon2id y se cierran sus sesiones abiertas', async () => {
    const abierta = await e.entrar('recepcion2');
    const id = await idDe('recepcion2');
    const r = await pedir('PATCH', `/usuarios/${id}`, { pin: '864209' });
    assert.equal(r.statusCode, 200);
    assert.equal(await sesionVale(abierta), 401);
    assert.equal((await entrarCon('recepcion2', PIN_PRUEBA)).statusCode, 401);
    assert.equal((await entrarCon('recepcion2', '864209')).statusCode, 201);
    const [f] = await e.bd.consultar<{ pin_hash: string }>('SELECT pin_hash FROM usuarios WHERE id = $1', [id]);
    assert.match(f.pin_hash, /^\$argon2id\$/);
    const auditado = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'ACTUALIZAR' AND entidad = 'usuarios' AND entidad_id = $1`, [id]);
    assert.deepEqual(auditado.map((x) => x.detalle), [{ pin: 'cambiado' }]);
  });

  it('desbloquear: quien se bloqueó por intentos fallidos puede volver a entrar sin esperar los 15 minutos', async () => {
    for (let i = 0; i < 5; i++) await entrarCon('recepcion4', '000000');
    assert.equal((await entrarCon('recepcion4', PIN_PRUEBA)).statusCode, 423);
    const id = await idDe('recepcion4');
    const lista = (await pedir('GET', '/usuarios')).json().items as Array<{ id: string; bloqueado_hasta: string | null }>;
    assert.equal(lista.find((u) => u.id === id)!.bloqueado_hasta, '2026-10-13T07:15:00-05:00');
    const r = await pedir('PATCH', `/usuarios/${id}`, { desbloquear: true });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().bloqueado_hasta, null);
    assert.equal((await entrarCon('recepcion4', PIN_PRUEBA)).statusCode, 201);
  });

  it('la administración no se desactiva a sí misma (el hotel no se queda sin quien administre): 409', async () => {
    const r = await pedir('PATCH', `/usuarios/${await idDe('admin')}`, { activo: false });
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().codigo, 'CONFLICTO');
    assert.equal(await sesionVale(admin), 200);
  });

  it('usuario que no existe: 404; sin cambios o con campos de más: 400', async () => {
    assert.equal((await pedir('PATCH', '/usuarios/00000000-0000-4000-8000-000000000000', { activo: false })).statusCode, 404);
    const id = await idDe('recepcion1');
    assert.equal((await pedir('PATCH', `/usuarios/${id}`, {})).statusCode, 400);
    assert.equal((await pedir('PATCH', `/usuarios/${id}`, { rol: 'ADMINISTRACION' })).statusCode, 400);
    assert.equal((await pedir('PATCH', `/usuarios/${id}`, { pin: '12a456' })).statusCode, 400);
  });
});

describe('FR-20 — Auditoría', () => {
  it('lista lo más reciente primero, con quién, qué acción y sobre qué; filtra por entidad y pagina', async () => {
    const r = await pedir('GET', '/auditoria?limite=5');
    assert.equal(r.statusCode, 200);
    const { items, total } = r.json();
    assert.equal(items.length, 5);
    assert.ok(total > 5);
    assert.deepEqual(Object.keys(items[0]).sort(), ['accion', 'detalle', 'entidad', 'entidad_id', 'id', 'ocurrido_en', 'usuario']);
    const ordenados = [...items].sort((a, b) => b.id - a.id);
    assert.deepEqual(items.map((x: { id: number }) => x.id), ordenados.map((x: { id: number }) => x.id));
    assert.match(items[0].ocurrido_en, /-05:00$/);

    const usuarios = (await pedir('GET', '/auditoria?entidad=usuarios&limite=100')).json();
    assert.ok(usuarios.items.length > 0);
    assert.ok(usuarios.items.every((x: { entidad: string }) => x.entidad === 'usuarios'));
    assert.equal(usuarios.total, usuarios.items.length);
    assert.ok(usuarios.items.some((x: { accion: string; usuario: string }) => x.accion === 'CREAR' && x.usuario === 'admin'));

    const siguiente = (await pedir('GET', '/auditoria?limite=5&desplazamiento=5')).json();
    assert.ok(siguiente.items.every((x: { id: number }) => x.id < items[4].id));
  });

  it('no expone datos de huéspedes ni PIN', async () => {
    const estadia = await pedir('POST', '/estadias', {
      habitacion_numero: '206', modalidad: 'NOCHE', personas: 1,
      huesped: { nombre: 'Huésped Prueba 77', tipo_documento: 'CC', numero_documento: 'PRUEBA7777', telefono: '+573000000077', nacionalidad: 'Colombia', es_menor: false },
      autorizacion: { otorgada: true, version_aviso: 'AV-2026-10' }, pago: { forma: 'EFECTIVO', valor_recibido: 45000 },
    }, await e.entrar('recepcion1'));
    assert.equal(estadia.statusCode, 201);
    const r = await pedir('GET', '/auditoria?limite=100');
    assert.ok(r.json().items.some((x: { entidad: string; entidad_id: string }) => x.entidad === 'estadias' && x.entidad_id === estadia.json().id));
    for (const dato of ['Huésped Prueba 77', 'PRUEBA7777', '3000000077', '246813', '864209', 'argon2']) assert.ok(!r.body.includes(dato), dato);
  });

  it('límite fuera de rango: 400', async () => {
    assert.equal((await pedir('GET', '/auditoria?limite=0')).statusCode, 400);
    assert.equal((await pedir('GET', '/auditoria?limite=101')).statusCode, 400);
  });
});
