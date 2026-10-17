// Carga datos sintéticos en una base de DESARROLLO.
// Uso: npm run db:sembrar              (falla si ya hay datos)
//      npm run db:reiniciar            (borra todo el esquema, migra y siembra de nuevo)
import { conectarPostgres } from './lib/bd.ts';
import { aplicarMigraciones } from './lib/migraciones.ts';
import { sembrar } from './lib/semilla.ts';

const reiniciar = process.argv.includes('--reiniciar');
const url = process.env.DATABASE_URL ?? '';
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error('Por seguridad, la semilla solo corre contra una base local (127.0.0.1 o localhost).');
  process.exit(1);
}

const bd = conectarPostgres(url);
try {
  if (reiniciar) {
    await bd.ejecutar('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('Esquema borrado.');
  }
  await aplicarMigraciones(bd);
  const [{ n }] = await bd.consultar<{ n: number }>('SELECT count(*)::int AS n FROM usuarios');
  if (n > 0) {
    console.error('La base ya tiene datos. Use npm run db:reiniciar para empezar de cero.');
    process.exitCode = 1;
  } else {
    const r = await sembrar(bd, process.env.SEMILLA_PIN_PRUEBA ?? '');
    console.log(`Listo: ${r.usuarios} usuarios de prueba, 12 habitaciones y un turno de noche abierto con $208.500.`);
    console.log(`Pago por verificar para probar el simulador: ${r.pagoPorVerificarId}`);
  }
} finally {
  await bd.cerrar();
}
