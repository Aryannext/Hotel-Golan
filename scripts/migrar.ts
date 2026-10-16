// Uso: npm run db:migrar   (lee DATABASE_URL de .env)
import { conectarPostgres } from './lib/bd.ts';
import { aplicarMigraciones } from './lib/migraciones.ts';

const bd = conectarPostgres();
try {
  const nuevas = await aplicarMigraciones(bd);
  console.log(nuevas.length ? `Migraciones aplicadas: ${nuevas.join(', ')}` : 'La base ya estaba al día.');
} finally {
  await bd.cerrar();
}
