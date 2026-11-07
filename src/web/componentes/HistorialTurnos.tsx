// Tabla de los últimos turnos (BOCETO 06). Solo la ve la administración: la ruta
// /turnos responde 403 a recepción, así que la pantalla ni siquiera la pide.
import { diaRelativo, hoyBogota, pesos } from '../logica.ts';
import type { FilaTurno } from '../caja.ts';
import { Ico } from './Ico.tsx';

export function HistorialTurnos({ filas, alVerTodos }: {
  filas: FilaTurno[];
  alVerTodos?: () => void;
}) {
  const hoy = hoyBogota();
  return (
    <section class="tarjeta historial-turnos" aria-label="Historial de turnos">
      <div class="tarjeta__cab tarjeta__cab--entre">
        <h2><Ico id="reloj" clase="ico--s" />Historial de turnos</h2>
        {alVerTodos && <button type="button" class="enlace enlace--s" onClick={alVerTodos}>
          Ver todos los turnos <Ico id="adelante" clase="ico--xs" />
        </button>}
      </div>
      {filas.length === 0
        ? <p class="vacio">Todavía no hay turnos registrados.</p>
        : <div class="tabla-env tabla-env-turnos">
          <table class="tabla tabla-turnos">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Turno</th>
                <th scope="col">Responsable</th>
                <th scope="col" class="num">Base</th>
                <th scope="col" class="num">Ingresos</th>
                <th scope="col" class="num">Egresos</th>
                <th scope="col" class="num">Esperado</th>
                <th scope="col" class="num">Contado</th>
                <th scope="col" class="num">Diferencia</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td data-label="Fecha">{diaRelativo(f.inicio, hoy)}</td>
                  <td data-label="Turno">{f.tipo === 'DIA' ? 'Día' : 'Noche'}</td>
                  <td data-label="Responsable">{f.responsable}</td>
                  <td data-label="Base recibida" class="num">{pesos(f.baseRecibida)}</td>
                  <td data-label="Ingresos" class="num">{pesos(f.ingresos)}</td>
                  <td data-label="Egresos" class="num">{pesos(f.egresos)}</td>
                  <td data-label="Efectivo esperado" class="num">{pesos(f.esperado)}</td>
                  {/* Guion mientras el turno no se haya entregado: el conteo no existe. */}
                  <td data-label="Efectivo contado" class="num">{f.contado === null ? '—' : pesos(f.contado)}</td>
                  <td data-label="Diferencia" class={`num${f.diferencia ? ' tabla-turnos__dif' : ''}`}>
                    {f.diferencia === null ? '—' : pesos(f.diferencia)}
                  </td>
                  <td data-label="Estado"><span class={`pill pill--${f.estado === 'Cerrado' ? 'neutro' : 'libre'}`}>{f.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </section>
  );
}
