// Arranque de una base nueva sin la semilla ficticia (HG-HAL-001 HAL-02; TICKET-19): catálogo base, una sola cuenta de
// administración y el primer turno «por recibir» con la base inicial. A recepción la crea la administración en Equipo.
// Solo corre en una base sin usuarios: nunca toca una base en uso.
import { hash } from '@node-rs/argon2';
import type { Bd } from './bd.ts';
import { HABITACIONES, PRODUCTOS, REGLAS, TARIFAS } from './catalogo-base.ts';

export interface DatosInicio {
  nombre: string;
  usuario: string;
  pin: string;
  /** Efectivo que queda en la caja para empezar (COP). */
  baseInicial: number;
  turno: 'DIA' | 'NOCHE';
  ahora: Date;
}

export async function iniciarHotel(bd: Bd, d: DatosInicio): Promise<{ habitaciones: number; tarifas: number; productos: number }> {
  if (!/^\d{6}$/.test(d.pin)) throw new Error('El PIN de la administración debe tener 6 dígitos.');
  if (!Number.isInteger(d.baseInicial) || d.baseInicial < 0) throw new Error('La base inicial debe ser un valor en pesos, entero y no negativo.');
  if (d.nombre.trim().length < 3 || !/^[a-z0-9._-]{3,40}$/.test(d.usuario)) throw new Error('Escriba un nombre y un usuario válidos (minúsculas, sin espacios).');
  const pinHash = await hash(d.pin);

  return bd.transaccion(async (tx) => {
    const [{ n }] = await tx.consultar<{ n: number }>('SELECT count(*)::int AS n FROM usuarios');
    if (n > 0) throw new Error('La base ya tiene usuarios: el arranque solo se hace una vez, en una base nueva.');
    const col = <T,>(filas: readonly T[][], i: number) => filas.map((f) => f[i]);
    const [admin] = await tx.consultar<{ id: string }>(
      `INSERT INTO usuarios (nombre, usuario, pin_hash, rol) VALUES ($1, $2, $3, 'ADMINISTRACION') RETURNING id`,
      [d.nombre.trim(), d.usuario, pinHash]);
    await tx.consultar(
      `INSERT INTO habitaciones (numero, tipo, estado) SELECT h.numero, h.tipo, 'DISPONIBLE' FROM unnest($1::text[], $2::text[]) AS h(numero, tipo)`,
      [col(HABITACIONES, 0), col(HABITACIONES, 1)]);
    await tx.consultar(
      `INSERT INTO tarifas (tipo_habitacion, modalidad, personas, valor, vigente_desde)
       SELECT t.*, $5 FROM unnest($1::text[], $2::text[], $3::int[], $4::int[]) AS t`,
      [col(TARIFAS, 0), col(TARIFAS, 1), col(TARIFAS, 2), col(TARIFAS, 3), d.ahora]);
    await tx.consultar('INSERT INTO reglas (clave, valor) SELECT * FROM unnest($1::text[], $2::int[]) ON CONFLICT (clave) DO NOTHING',
      [col(REGLAS, 0), col(REGLAS, 1)]);
    await tx.consultar('INSERT INTO productos (nombre, grupo, precio) SELECT * FROM unnest($1::text[], $2::text[], $3::int[])',
      [col(PRODUCTOS, 0), col(PRODUCTOS, 1), col(PRODUCTOS, 2)]);
    // El primer turno queda «por recibir»: quien llega cuenta la base y lo abre, como en cualquier relevo.
    const pagoTurno = REGLAS.find(([k]) => k === (d.turno === 'DIA' ? 'pago_turno_dia' : 'pago_turno_noche'))![1];
    await tx.consultar(
      `INSERT INTO turnos (tipo, estado, recibido_de_id, inicio_en, base_entregada, pago_turno) VALUES ($1, 'POR_RECIBIR', $2, $3, $4, $5)`,
      [d.turno, admin.id, d.ahora, d.baseInicial, pagoTurno]);
    await tx.consultar(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ocurrido_en) VALUES ($1, 'CREAR', 'usuarios', $2, $3, $4)`,
      [admin.id, admin.id, JSON.stringify({ arranque: 'si' }), d.ahora]);
    return { habitaciones: HABITACIONES.length, tarifas: TARIFAS.length, productos: PRODUCTOS.length };
  });
}
