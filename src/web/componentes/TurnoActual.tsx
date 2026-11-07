// Tarjeta grande del turno en curso (BOCETO 06): base, ingresos, egresos, esperado,
// contado, pago del turno y diferencia. Solo pinta: las cifras las arma `caja.ts`.
import { pesos } from '../logica.ts';
import { estadoTurno, type LineaCaja } from '../caja.ts';
import type { Turno } from '../api.ts';
import { Ico } from './Ico.tsx';

/** Un ícono por línea, para que se reconozcan sin leer la etiqueta. */
const ICONOS: Record<string, string> = {
  'Base recibida': 'caja',
  'Ingresos en efectivo': 'sube',
  'Egresos en efectivo': 'baja',
  'Efectivo esperado': 'efectivo',
  'Efectivo contado': 'caja',
  'Pago del turno': 'tarjeta-pago',
  Diferencia: 'reportes',
};

export function TurnoActual({ turno, lineas, desde, children }: {
  turno: Turno;
  lineas: LineaCaja[];
  /** Hora de inicio ya en palabras, por ejemplo «7:00 a. m.». */
  desde: string;
  /** El motivo de la diferencia u otra nota que vaya al lado. */
  children?: preact.ComponentChildren;
}) {
  const estado = estadoTurno(turno);
  return (
    <section class="tarjeta turno-actual" aria-label="Turno actual">
      <div class="turno-actual__cab">
        <span class={`turno-actual__ico turno-actual__ico--${turno.tipo === 'DIA' ? 'dia' : 'noche'}`}>
          <Ico id={turno.tipo === 'DIA' ? 'dona' : 'reloj'} clase="ico--l" />
        </span>
        <div class="turno-actual__titulos">
          <h2>Turno actual · {turno.tipo === 'DIA' ? 'Día' : 'Noche'}</h2>
          <p>{estado === 'En curso' ? `En curso desde las ${desde}` : `${estado} · empezó a las ${desde}`}</p>
        </div>
        <span class={`pill pill--${estado === 'En curso' ? 'libre' : 'neutro'}`}>
          {estado === 'En curso' ? 'Turno en curso' : estado}
        </span>
      </div>

      <div class="turno-actual__cuerpo">
        <ul class="lineas-caja">
          {lineas.map((l) => (
            <li key={l.etiqueta} class={`linea-caja${l.tono ? ` linea-caja--${l.tono}` : ''}`}>
              <span class="linea-caja__ico"><Ico id={ICONOS[l.etiqueta] ?? 'efectivo'} clase="ico--s" /></span>
              <span class="linea-caja__etq">{l.etiqueta}</span>
              {/* Un guion y no «$0»: mientras el turno siga abierto, esa cifra no existe. */}
              <strong class="linea-caja__valor">
                {l.valor === null ? <span class="linea-caja__sin" title="Se registra al entregar el turno">—</span> : pesos(l.valor)}
              </strong>
            </li>
          ))}
        </ul>
        {children}
      </div>
    </section>
  );
}
