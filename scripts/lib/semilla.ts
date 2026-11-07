// Datos sintéticos para desarrollo y pruebas. NADA aquí es un dato real del hotel ni de un huésped:
// los nombres dicen «Prueba», los documentos empiezan con «PRUEBA» y no existen.
// Reglas y precios: docs/PRD.md §4.1 (fuente HG-ACT-001). Fecha base fija para que las pruebas sean repetibles.
// @node-rs/argon2 usa Argon2id por defecto (ADR-003); la prueba «guarda el PIN como hash Argon2id» lo verifica.
import { hash } from '@node-rs/argon2';
import type { Bd } from './bd.ts';
import { PRODUCTOS, REGLAS, TARIFAS } from './catalogo-base.ts';

const BASE = '2026-10-12'; // lunes de demostración; horas en America/Bogota (-05:00)
const t = (dia: string, hhmm: string) => `${dia}T${hhmm}:00-05:00`;
const SIGUIENTE = '2026-10-13';

export const USUARIOS_PRUEBA = [
  { usuario: 'recepcion1', nombre: 'Recepción Prueba 1 (día entre semana)', rol: 'RECEPCION' },
  { usuario: 'recepcion2', nombre: 'Recepción Prueba 2 (noche entre semana)', rol: 'RECEPCION' },
  { usuario: 'recepcion3', nombre: 'Recepción Prueba 3 (fines de semana)', rol: 'RECEPCION' },
  { usuario: 'recepcion4', nombre: 'Recepción Prueba 4 (fines de semana)', rol: 'RECEPCION' },
  { usuario: 'admin', nombre: 'Administradora Prueba', rol: 'ADMINISTRACION' },
  { usuario: 'duena', nombre: 'Propietaria Prueba', rol: 'ADMINISTRACION' },
] as const;

const HABITACIONES: Array<[string, 'AIRE' | 'VENTILADOR', string, string | null]> = [
  ['201', 'AIRE', 'DISPONIBLE', null], ['202', 'AIRE', 'DISPONIBLE', null], ['203', 'AIRE', 'DISPONIBLE', null],
  ['204', 'AIRE', 'LIMPIEZA', 'Cambio de sábanas'], ['205', 'VENTILADOR', 'OCUPADA', null],
  ['206', 'VENTILADOR', 'DISPONIBLE', null], ['207', 'VENTILADOR', 'POR_REVISAR', 'Salió a las 5:50 a. m.'],
  ['208', 'VENTILADOR', 'DISPONIBLE', null], ['209', 'VENTILADOR', 'DISPONIBLE', null],
  ['210', 'VENTILADOR', 'DISPONIBLE', null], ['211', 'VENTILADOR', 'OCUPADA', null],
  ['301', 'AIRE', 'MANTENIMIENTO', 'Ducha en reparación'],
];

// Tarifas, reglas y productos: catálogo base compartido con el arranque de una base nueva (catalogo-base.ts).

export interface ResumenSemilla {
  usuarios: number;
  turnoId: string;
  pagoPorVerificarId: string;
}

export async function sembrar(bd: Bd, pinPrueba: string): Promise<ResumenSemilla> {
  if (!/^\d{6}$/.test(pinPrueba)) throw new Error('SEMILLA_PIN_PRUEBA debe tener 6 dígitos.');
  const pinHash = await hash(pinPrueba);

  return bd.transaccion(async (tx) => {
    // Cada tabla del catálogo va en una sola consulta (columna por columna con unnest).
    const col = <T,>(filas: readonly T[][], i: number) => filas.map((f) => f[i]);
    const usuarios = await tx.consultar<{ id: string; usuario: string }>(
      `INSERT INTO usuarios (nombre, usuario, pin_hash, rol)
       SELECT u.nombre, u.usuario, $3, u.rol FROM unnest($1::text[], $2::text[], $4::text[]) AS u(nombre, usuario, rol)
       RETURNING id, usuario`,
      [USUARIOS_PRUEBA.map((u) => u.nombre), USUARIOS_PRUEBA.map((u) => u.usuario), pinHash, USUARIOS_PRUEBA.map((u) => u.rol)],
    );
    const ids: Record<string, string> = Object.fromEntries(usuarios.map((u) => [u.usuario, u.id]));
    await tx.consultar(
      'INSERT INTO habitaciones (numero, tipo, estado, nota) SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])',
      [col(HABITACIONES, 0), col(HABITACIONES, 1), col(HABITACIONES, 2), col(HABITACIONES, 3)],
    );
    await tx.consultar(
      `INSERT INTO tarifas (tipo_habitacion, modalidad, personas, valor, vigente_desde)
       SELECT t.*, $5 FROM unnest($1::text[], $2::text[], $3::int[], $4::int[]) AS t`,
      [col(TARIFAS, 0), col(TARIFAS, 1), col(TARIFAS, 2), col(TARIFAS, 3), t('2026-10-01', '00:00')],
    );
    await tx.consultar('INSERT INTO reglas (clave, valor) SELECT * FROM unnest($1::text[], $2::int[])', [col(REGLAS, 0), col(REGLAS, 1)]);
    const productos = await tx.consultar<{ id: string; nombre: string }>(
      'INSERT INTO productos (nombre, grupo, precio) SELECT * FROM unnest($1::text[], $2::text[], $3::int[]) RETURNING id, nombre',
      [col(PRODUCTOS, 0), col(PRODUCTOS, 1), col(PRODUCTOS, 2)],
    );
    const producto: Record<string, string> = Object.fromEntries(productos.map((p) => [p.nombre, p.id]));

    // Turno de noche abierto: recibió $208.500 (ejemplo real del relevo, HG-LEV-001 §6.1).
    const [turno] = await tx.consultar<{ id: string }>(
      `INSERT INTO turnos (tipo, estado, responsable_id, recibido_de_id, inicio_en, base_entregada, base_recibida, pago_turno)
       VALUES ('NOCHE', 'ABIERTO', $1, $2, $3, 208500, 208500, 50000) RETURNING id`,
      [ids.recepcion2, ids.recepcion1, t(BASE, '18:30')],
    );

    async function estadia(n: number, hab: string, personas: number, entrada: string, formaCobro: string) {
      const [h] = await tx.consultar<{ id: string }>(
        `INSERT INTO huespedes (nombre, tipo_documento, numero_documento, nacionalidad)
         VALUES ($1, 'CC', $2, 'Colombia') RETURNING id`,
        [`Huésped Prueba ${String(n).padStart(2, '0')}`, `PRUEBA${String(n).padStart(4, '0')}`],
      );
      await tx.consultar(
        `INSERT INTO autorizaciones_datos (huesped_id, version_aviso, otorgada_en, registrada_por) VALUES ($1, 'AV-2026-10', $2, $3)`,
        [h.id, entrada, ids.recepcion2],
      );
      const [e] = await tx.consultar<{ id: string }>(
        `INSERT INTO estadias (habitacion_numero, huesped_id, turno_id, modalidad, personas, noches, entrada_en,
                               salida_prevista_en, forma_cobro, creada_por, creada_en)
         VALUES ($1, $2, $3, 'NOCHE', $4, 1, $5, $6, $7, $8, $5) RETURNING id`,
        [hab, h.id, turno.id, personas, entrada, t(SIGUIENTE, '12:00'), formaCobro, ids.recepcion2],
      );
      return e.id;
    }
    async function cargo(estadiaId: string, tipo: string, concepto: string, valor: number, hora: string, productoId: string | null = null) {
      await tx.consultar(
        `INSERT INTO cargos (estadia_id, producto_id, tipo, concepto, cantidad, valor_unitario, valor, creado_por, creado_en)
         VALUES ($1, $2, $3, $4, 1, $5, $5, $6, $7)`,
        [estadiaId, productoId, tipo, concepto, valor, ids.recepcion2, hora],
      );
    }
    async function pago(estadiaId: string, medio: string, valor: number, estado: string, hora: string): Promise<string> {
      const verificado = estado === 'VERIFICADO';
      const [p] = await tx.consultar<{ id: string }>(
        `INSERT INTO pagos (estadia_id, turno_id, medio, valor, estado, registrado_por, registrado_en, verificado_por, verificado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [estadiaId, turno.id, medio, valor, estado, ids.recepcion2, hora, verificado ? ids.admin : null, verificado ? hora : null],
      );
      return p.id;
    }

    // Caja esperada del turno: 208.500 + 26.000 en efectivo = 234.500; transferencias aparte = 85.000.
    const e205 = await estadia(1, '205', 2, t(BASE, '19:10'), 'ANTICIPADO');
    await cargo(e205, 'ALOJAMIENTO', 'Noche · ventilador, 2 personas', 55000, t(BASE, '19:10'));
    await pago(e205, 'NEQUI', 55000, 'VERIFICADO', t(BASE, '19:12'));

    const e211 = await estadia(2, '211', 3, t(BASE, '20:10'), 'AL_SALIR');
    await cargo(e211, 'ALOJAMIENTO', 'Noche · ventilador, 3 personas', 80000, t(BASE, '20:10'));
    await cargo(e211, 'PRODUCTO', 'Coca-Cola', 4000, t(SIGUIENTE, '00:15'), producto['Coca-Cola']);
    const pendiente = await pago(e211, 'BANCOLOMBIA', 30000, 'POR_VERIFICAR', t(BASE, '20:12'));
    await pago(e211, 'EFECTIVO', 22000, 'EN_CAJA', t(BASE, '23:30'));
    await pago(e211, 'EFECTIVO', 4000, 'EN_CAJA', t(SIGUIENTE, '00:15'));

    return { usuarios: USUARIOS_PRUEBA.length, turnoId: turno.id, pagoPorVerificarId: pendiente };
  });
}
