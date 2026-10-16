// Simula a la administradora confirmando transferencias desde el celular (opción B).
// Uso: npm run simular:verificacion                         → lista los pagos por verificar
//      npm run simular:verificacion -- <pago_id> LLEGO       → confirma (también acepta NO_LLEGO)
//      npm run simular:verificacion -- <pago_id> LLEGO <clave-uuid>   → repetir la clave no duplica (Inbox)
import { randomUUID } from 'node:crypto';
import { conectarPostgres } from './lib/bd.ts';
import { verificarPago, type ResultadoVerificacion } from './lib/verificacion.ts';

const [pagoId, resultado, clave] = process.argv.slice(2);
const bd = conectarPostgres();
try {
  if (!pagoId) {
    const pendientes = await bd.consultar<{ id: string; habitacion: string; medio: string; valor: number }>(
      `SELECT p.id, e.habitacion_numero AS habitacion, p.medio, p.valor
         FROM pagos p JOIN estadias e ON e.id = p.estadia_id
        WHERE p.estado = 'POR_VERIFICAR' AND p.anulado_en IS NULL ORDER BY p.registrado_en`);
    console.table(pendientes);
  } else {
    if (resultado !== 'LLEGO' && resultado !== 'NO_LLEGO') throw new Error('El resultado debe ser LLEGO o NO_LLEGO');
    const [admin] = await bd.consultar<{ id: string }>(
      `SELECT id FROM usuarios WHERE rol = 'ADMINISTRACION' AND activo ORDER BY creado_en LIMIT 1`);
    const r = await verificarPago(bd, {
      pagoId, resultado: resultado as ResultadoVerificacion, usuarioId: admin.id, clave: clave ?? randomUUID(),
    });
    console.log(r.repetida ? `Clave repetida: no se aplicó de nuevo (${r.estado}).` : `Pago ${r.estado}: $${r.valor.toLocaleString('es-CO')}`);
  }
} finally {
  await bd.cerrar();
}
