// Protección de los datos de prueba (HG-HAL-001 HAL-05): la semilla y `db:reiniciar` (DROP SCHEMA) solo corren con
// HOTEL_ENTORNO=desarrollo y contra una base local. En el VPS no existe esa variable, aunque la base sea 127.0.0.1.

export function permisoDatosDePrueba(env: { HOTEL_ENTORNO?: string; DATABASE_URL?: string }): { ok: true } | { ok: false; motivo: string } {
  if (env.HOTEL_ENTORNO !== 'desarrollo') {
    return { ok: false, motivo: 'Los datos de prueba solo se cargan en desarrollo: agregue HOTEL_ENTORNO=desarrollo al .env del PC de desarrollo (nunca en el VPS).' };
  }
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(env.DATABASE_URL ?? '')) {
    return { ok: false, motivo: 'Por seguridad, la semilla solo corre contra una base local (127.0.0.1 o localhost).' };
  }
  return { ok: true };
}
