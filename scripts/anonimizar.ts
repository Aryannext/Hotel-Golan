// Corre a mano la anonimización de huéspedes (FR-21). El servidor ya la corre al arrancar y cada hora;
// esto sirve para comprobarla en el VPS. Uso: npm run privacidad:anonimizar
import { conectarPostgres } from './lib/bd.ts';
import { anonimizarVencidos } from '../src/api/privacidad/anonimizacion.ts';

const bd = conectarPostgres();
try {
  const { anonimizados } = await anonimizarVencidos(bd, new Date());
  console.log(anonimizados === 0 ? 'No hay huéspedes por anonimizar.' : `Huéspedes anonimizados: ${anonimizados}.`);
} finally {
  await bd.cerrar();
}
