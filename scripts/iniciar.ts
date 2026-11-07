// Arranque de una base nueva, sin la semilla ficticia (HG-HAL-001 HAL-02; TICKET-19).
// Uso, una sola vez, en la base nueva (los datos van en la línea de comandos, no en el .env):
//   INICIO_NOMBRE="Nombre de la administradora" INICIO_USUARIO=usuario INICIO_PIN=###### INICIO_BASE=150000 \
//   INICIO_TURNO=NOCHE npm run db:iniciar
// Aplica las migraciones, carga el catálogo base y deja la cuenta de administración y el primer turno por recibir.
import { conectarPostgres } from './lib/bd.ts';
import { aplicarMigraciones } from './lib/migraciones.ts';
import { iniciarHotel } from './lib/inicio.ts';

const e = process.env;
const turno = e.INICIO_TURNO === 'DIA' ? 'DIA' : 'NOCHE';
const bd = conectarPostgres();
try {
  const nuevas = await aplicarMigraciones(bd);
  if (nuevas.length) console.log(`Migraciones aplicadas: ${nuevas.join(', ')}`);
  const r = await iniciarHotel(bd, {
    nombre: e.INICIO_NOMBRE ?? '', usuario: e.INICIO_USUARIO ?? '', pin: e.INICIO_PIN ?? '',
    baseInicial: Number(e.INICIO_BASE ?? Number.NaN), turno, ahora: new Date(),
  });
  console.log(`Listo: ${r.habitaciones} habitaciones, ${r.tarifas} tarifas y ${r.productos} productos.`);
  console.log(`La administración entra con su usuario; crea a recepción en Equipo. El turno ${turno === 'DIA' ? 'de día' : 'de noche'} queda por recibir.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await bd.cerrar();
}
