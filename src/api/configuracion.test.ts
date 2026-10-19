// TICKET-15 · PUT /tarifas, GET y PATCH /reglas, POST y PUT /productos (FR-22) según docs/CONTRATO_API.yaml.
// Un cambio de configuración aplica a lo nuevo, nunca a lo ya registrado.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Entorno } from './pruebas/entorno.ts';

let e: Entorno;
let admin: string;
let recepcion: string;
before(async () => {
  e = await crearEntorno();
  e.fijarHora('2026-10-13T05:00:00-05:00');
  admin = await e.entrar('admin');
  recepcion = await e.entrar('recepcion2');
});
after(async () => e.cerrar());

const pedir = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: unknown, cookie = admin) =>
  e.app.inject({ method, url: `/api/v1${url}`, payload: payload as object, headers: { cookie } });
const cotizar = async (cuerpo: Record<string, unknown>) => (await pedir('POST', '/cotizaciones', cuerpo, recepcion)).json();
const auditado = (entidad: string) => e.bd.consultar<{ usuario: string; detalle: Record<string, string> }>(
  `SELECT u.usuario, a.detalle FROM auditoria a JOIN usuarios u ON u.id = a.usuario_id WHERE a.accion = 'ACTUALIZAR' AND a.entidad = $1 ORDER BY a.id`, [entidad]);
const estadia211 = async () => (await e.bd.consultar<{ id: string }>(`SELECT id FROM estadias WHERE habitacion_numero = '211' AND estado = 'ACTIVA'`))[0].id;

describe('FR-22 — Permisos de la configuración', () => {
  it('recepción consulta tarifas y reglas, pero no cambia nada: 403 SIN_PERMISO', async () => {
    assert.equal((await pedir('GET', '/tarifas', undefined, recepcion)).statusCode, 200);
    assert.equal((await pedir('GET', '/reglas', undefined, recepcion)).statusCode, 200);
    const [p] = await e.bd.consultar<{ id: string }>(`SELECT id FROM productos WHERE nombre = 'Agua'`);
    for (const r of [
      await pedir('PUT', '/tarifas', { items: [{ tipo_habitacion: 'AIRE', modalidad: 'NOCHE', personas: 1, valor: 1 }] }, recepcion),
      await pedir('PATCH', '/reglas', { descuento_noche: 0 }, recepcion),
      await pedir('POST', '/productos', { nombre: 'Jugo', grupo: 'NEVERA', precio: 3000, pertenece_a: 'HOTEL', activo: true }, recepcion),
      await pedir('PUT', `/productos/${p.id}`, { nombre: 'Agua', grupo: 'NEVERA', precio: 1, pertenece_a: 'HOTEL', activo: true }, recepcion),
      await pedir('GET', '/productos?incluir_inactivos=true', undefined, recepcion),
    ]) {
      assert.equal(r.statusCode, 403);
      assert.equal(r.json().codigo, 'SIN_PERMISO');
    }
  });
});

describe('FR-22 — Tarifas con vigencia', () => {
  it('GET /tarifas: las 8 tarifas vigentes con su fecha de inicio', async () => {
    const items = (await pedir('GET', '/tarifas')).json().items as Array<Record<string, unknown>>;
    assert.equal(items.length, 8);
    assert.deepEqual(Object.keys(items[0]).sort(), ['id', 'modalidad', 'personas', 'tipo_habitacion', 'valor', 'vigente_desde']);
    const aire1 = items.find((t) => t.tipo_habitacion === 'AIRE' && t.modalidad === 'NOCHE' && t.personas === 1)!;
    assert.equal(aire1.valor, 60000);
    assert.match(String(aire1.vigente_desde), /-05:00$/);
  });

  it('PUT /tarifas crea una vigencia nueva: lo cotizado antes del cambio conserva el precio anterior', async () => {
    const r = await pedir('PUT', '/tarifas', { items: [{ tipo_habitacion: 'AIRE', modalidad: 'NOCHE', personas: 1, valor: 65000 }] });
    assert.equal(r.statusCode, 200);
    const items = r.json().items as Array<{ tipo_habitacion: string; modalidad: string; personas: number; valor: number; vigente_desde: string }>;
    assert.equal(items.length, 8);
    const aire1 = items.find((t) => t.tipo_habitacion === 'AIRE' && t.modalidad === 'NOCHE' && t.personas === 1)!;
    assert.deepEqual([aire1.valor, aire1.vigente_desde], [65000, '2026-10-13T05:00:00-05:00']);
    assert.equal(items.find((t) => t.tipo_habitacion === 'AIRE' && t.modalidad === 'NOCHE' && t.personas === 2)!.valor, 70000);
    // La fila anterior no se borra ni se modifica.
    const filas = await e.bd.consultar<{ valor: number }>(
      `SELECT valor FROM tarifas WHERE tipo_habitacion = 'AIRE' AND modalidad = 'NOCHE' AND personas = 1 ORDER BY vigente_desde`);
    assert.deepEqual(filas.map((f) => f.valor), [60000, 65000]);
    const base = { habitacion_numero: '201', modalidad: 'NOCHE', personas: 1 };
    assert.equal((await cotizar({ ...base, entrada_en: '2026-10-13T04:59:00-05:00' })).tarifa, 60000);
    assert.equal((await cotizar(base)).tarifa, 65000);
    const [a] = await auditado('tarifas');
    assert.deepEqual([a.usuario, a.detalle], ['admin', { 'AIRE NOCHE 1': '65000' }]);
  });

  it('una entrada registrada antes del cambio no cambia de valor', async () => {
    const r = await pedir('PUT', '/tarifas', { items: [{ tipo_habitacion: 'VENTILADOR', modalidad: 'NOCHE', personas: 3, valor: 85000 }] });
    assert.equal(r.statusCode, 200);
    const id = await estadia211();
    const est = (await pedir('GET', `/estadias/${id}`, undefined, recepcion)).json();
    assert.ok(est.cargos.some((c: { tipo: string; valor: number }) => c.tipo === 'ALOJAMIENTO' && c.valor === 80000));
  });

  it('tres horas solo lleva personas = 2; combinaciones repetidas o valores en 0: 400', async () => {
    const tres = await pedir('PUT', '/tarifas', { items: [{ tipo_habitacion: 'AIRE', modalidad: 'TRES_HORAS', personas: 1, valor: 30000 }] });
    assert.equal(tres.statusCode, 400);
    assert.match(tres.json().mensaje, /tres horas/i);
    const fila = { tipo_habitacion: 'AIRE', modalidad: 'NOCHE', personas: 2, valor: 72000 };
    assert.equal((await pedir('PUT', '/tarifas', { items: [fila, { ...fila, valor: 73000 }] })).statusCode, 400);
    assert.equal((await pedir('PUT', '/tarifas', { items: [{ ...fila, valor: 0 }] })).statusCode, 400);
    assert.equal((await pedir('PUT', '/tarifas', { items: [] })).statusCode, 400);
  });
});

describe('FR-22 — Reglas numéricas', () => {
  it('GET /reglas devuelve los ocho valores configurables', async () => {
    const r = await pedir('GET', '/reglas', undefined, recepcion);
    assert.deepEqual(r.json(), {
      valor_hora: 8000, hora_noche_completa: 16, descuento_noche: 5000, pago_turno_dia: 70000, pago_turno_noche: 50000, retencion_datos_dias: 90,
      minutos_cambio_sin_cargo: 5, // TICKET-26 (migración 0007)
      horas_reporte_migracion: 24, // TICKET-37 (migración 0009)
    });
  });

  it('PATCH /reglas cambia solo lo enviado, queda auditado y aplica a las cotizaciones nuevas', async () => {
    e.avanzarMinutos(1);
    const r = await pedir('PATCH', '/reglas', { descuento_noche: 6000, valor_hora: 9000 });
    assert.equal(r.statusCode, 200);
    assert.deepEqual([r.json().descuento_noche, r.json().valor_hora, r.json().hora_noche_completa], [6000, 9000, 16]);
    const c = await cotizar({ habitacion_numero: '201', modalidad: 'NOCHE', personas: 1, aplicar_descuento: true });
    assert.deepEqual([c.tarifa, c.descuento, c.total], [65000, 6000, 59000]);
    const [f] = await e.bd.consultar<{ usuario: string }>(
      `SELECT u.usuario FROM reglas r JOIN usuarios u ON u.id = r.actualizado_por WHERE r.clave = 'descuento_noche'`);
    assert.equal(f.usuario, 'admin');
    const ultimo = (await auditado('reglas')).at(-1)!;
    assert.deepEqual(ultimo.detalle, { descuento_noche: '6000', valor_hora: '9000' });
  });

  it('el pago del turno ya abierto no cambia; aplica desde el turno siguiente', async () => {
    const antes = (await pedir('GET', '/turnos/actual', undefined, recepcion)).json().caja.pago_turno;
    assert.equal((await pedir('PATCH', '/reglas', { pago_turno_noche: 55000 })).statusCode, 200);
    assert.equal((await pedir('GET', '/turnos/actual', undefined, recepcion)).json().caja.pago_turno, antes);
  });

  it('cuerpo vacío, claves desconocidas u horas fuera de rango: 400', async () => {
    assert.equal((await pedir('PATCH', '/reglas', {})).statusCode, 400);
    assert.equal((await pedir('PATCH', '/reglas', { iva: 19 })).statusCode, 400);
    assert.equal((await pedir('PATCH', '/reglas', { hora_noche_completa: 11 })).statusCode, 400);
    assert.equal((await pedir('PATCH', '/reglas', { retencion_datos_dias: 0 })).statusCode, 400);
  });
});

describe('FR-22 — Catálogo de productos', () => {
  it('crear un producto: 201, aparece en el catálogo y queda auditado', async () => {
    const r = await pedir('POST', '/productos', { nombre: 'Jugo Hit grande', grupo: 'NEVERA', precio: 5500, pertenece_a: 'HOTEL', activo: true });
    assert.equal(r.statusCode, 201);
    assert.deepEqual([r.json().nombre, r.json().precio, r.json().seccion, r.json().activo], ['Jugo Hit grande', 5500, null, true]);
    const catalogo = (await pedir('GET', '/productos', undefined, recepcion)).json().items as Array<{ id: string }>;
    assert.ok(catalogo.some((p) => p.id === r.json().id));
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'CREAR' AND entidad = 'productos' AND entidad_id = $1`, [r.json().id]);
    assert.deepEqual(a.detalle, { precio: '5500' });
  });

  it('RN-13 (V5-19): los productos de la familiar no van en el sistema; ningún producto es de otro dueño: 400', async () => {
    const familiar = await pedir('POST', '/productos', { nombre: 'Champú sobre', grupo: 'VITRINA_ASEO', precio: 1500, pertenece_a: 'FAMILIAR', activo: true });
    assert.equal(familiar.statusCode, 400);
    const [n] = await e.bd.consultar<{ n: number }>(`SELECT count(*)::int AS n FROM productos WHERE nombre = 'Champú sobre'`);
    assert.equal(n.n, 0);
  });

  it('RN-13 (V5-19): la regla es por dueño, no por sección: un producto del hotel puede ir en la sección 1 (antes, 400)', async () => {
    const r = await pedir('POST', '/productos', { nombre: 'Agua sección uno', grupo: 'VITRINA_PASABOCAS', precio: 2000, seccion: 1, activo: true });
    assert.equal(r.statusCode, 201, r.body);
    assert.deepEqual([r.json().seccion, r.json().pertenece_a], [1, 'HOTEL']);
    assert.equal((await pedir('POST', '/productos', { nombre: 'Agua sección siete', grupo: 'VITRINA_PASABOCAS', precio: 2000, seccion: 7, activo: true })).statusCode, 400);
  });

  it('FR-24: la administración crea un producto de vitrina sin indicar dueño (queda del hotel) y recepción lo carga a una habitación', async () => {
    const r = await pedir('POST', '/productos', { nombre: 'Galletas de prueba', grupo: 'VITRINA_PASABOCAS', precio: 2000, activo: true });
    assert.equal(r.statusCode, 201);
    assert.deepEqual([r.json().grupo, r.json().pertenece_a, r.json().precio], ['VITRINA_PASABOCAS', 'HOTEL', 2000]);
    const catalogo = (await pedir('GET', '/productos', undefined, recepcion)).json().items as Array<{ id: string }>;
    assert.ok(catalogo.some((p) => p.id === r.json().id));
    const cargo = await e.app.inject({
      method: 'POST', url: `/api/v1/estadias/${await estadia211()}/cargos`,
      payload: { items: [{ producto_id: r.json().id, cantidad: 2 }] }, headers: { cookie: recepcion },
    });
    assert.equal(cargo.statusCode, 201);
    const nuevo = (cargo.json().cargos as Array<{ concepto: string; tipo: string; valor: number }>).find((c) => c.concepto === 'Galletas de prueba');
    assert.deepEqual([nuevo?.tipo, nuevo?.valor], ['PRODUCTO', 4000]);
  });

  it('FR-24: productos de la vitrina de aseo también se crean y se editan', async () => {
    const r = await pedir('POST', '/productos', { nombre: 'Jabón de prueba', grupo: 'VITRINA_ASEO', precio: 3000, activo: true });
    assert.equal(r.statusCode, 201);
    const cambio = await pedir('PUT', `/productos/${r.json().id}`, { nombre: 'Jabón de prueba', grupo: 'VITRINA_ASEO', precio: 3500, activo: true });
    assert.equal(cambio.statusCode, 200);
    assert.equal(cambio.json().precio, 3500);
  });

  it('nombre repetido en el mismo grupo: 409; precio negativo o grupo desconocido: 400', async () => {
    const rep = await pedir('POST', '/productos', { nombre: 'Agua', grupo: 'NEVERA', precio: 2500, pertenece_a: 'HOTEL', activo: true });
    assert.equal(rep.statusCode, 409);
    assert.equal(rep.json().codigo, 'CONFLICTO');
    assert.equal((await pedir('POST', '/productos', { nombre: 'Agua 2', grupo: 'NEVERA', precio: -1, pertenece_a: 'HOTEL', activo: true })).statusCode, 400);
    assert.equal((await pedir('POST', '/productos', { nombre: 'Agua 2', grupo: 'BAR', precio: 1, pertenece_a: 'HOTEL', activo: true })).statusCode, 400);
  });

  it('cambiar un precio no altera un cargo anterior; los cargos nuevos usan el precio nuevo', async () => {
    const [p] = await e.bd.consultar<{ id: string }>(`SELECT id FROM productos WHERE nombre = 'Coca-Cola'`);
    const id = await estadia211();
    const cargoAntes = async () => (await pedir('GET', `/estadias/${id}`, undefined, recepcion)).json().cargos
      .filter((c: { concepto: string }) => c.concepto.startsWith('Coca-Cola')) as Array<{ valor_unitario: number; valor: number }>;
    assert.deepEqual((await cargoAntes()).map((c) => c.valor), [4000]);
    const r = await pedir('PUT', `/productos/${p.id}`, { nombre: 'Coca-Cola', grupo: 'NEVERA', precio: 4500, pertenece_a: 'HOTEL', activo: true });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().precio, 4500);
    assert.deepEqual((await cargoAntes()).map((c) => c.valor), [4000]);
    await e.app.inject({ method: 'POST', url: `/api/v1/estadias/${id}/cargos`, payload: { items: [{ producto_id: p.id, cantidad: 1 }] }, headers: { cookie: recepcion } });
    assert.deepEqual((await cargoAntes()).map((c) => c.valor), [4000, 4500]);
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'ACTUALIZAR' AND entidad = 'productos' AND entidad_id = $1`, [p.id]);
    assert.deepEqual(a.detalle, { precio: '4500' });
  });

  it('desactivar un producto lo quita del catálogo de recepción; la administración lo sigue viendo para reactivarlo', async () => {
    const [p] = await e.bd.consultar<{ id: string }>(`SELECT id FROM productos WHERE nombre = 'Squash'`);
    const r = await pedir('PUT', `/productos/${p.id}`, { nombre: 'Squash', grupo: 'NEVERA', precio: 4000, pertenece_a: 'HOTEL', activo: false });
    assert.equal(r.json().activo, false);
    const visibles = (await pedir('GET', '/productos', undefined, recepcion)).json().items as Array<{ id: string }>;
    assert.ok(!visibles.some((x) => x.id === p.id));
    const todos = (await pedir('GET', '/productos?incluir_inactivos=true')).json().items as Array<{ id: string; activo: boolean }>;
    assert.deepEqual(todos.find((x) => x.id === p.id)?.activo, false);
    const [a] = await e.bd.consultar<{ detalle: Record<string, string> }>(
      `SELECT detalle FROM auditoria WHERE accion = 'ACTUALIZAR' AND entidad = 'productos' AND entidad_id = $1`, [p.id]);
    assert.deepEqual(a.detalle, { activo: 'no' });
  });

  it('producto que no existe: 404; renombrar a un nombre que ya existe en el grupo: 409', async () => {
    const cuerpo = { nombre: 'Agua', grupo: 'NEVERA', precio: 2500, pertenece_a: 'HOTEL', activo: true };
    assert.equal((await pedir('PUT', '/productos/00000000-0000-4000-8000-000000000000', cuerpo)).statusCode, 404);
    const [p] = await e.bd.consultar<{ id: string }>(`SELECT id FROM productos WHERE nombre = 'Hit'`);
    assert.equal((await pedir('PUT', `/productos/${p.id}`, cuerpo)).statusCode, 409);
  });
});
