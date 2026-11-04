// Tarjetas cortas de la derecha (BOCETO 06): el último turno de día y el de noche,
// con lo justo para comparar de un vistazo. Sin turno de ese tipo todavía, lo dice
// en vez de mostrar una tarjeta con ceros que parecerían reales.
import { pesos } from '../logica.ts';
import { estadoTurno } from '../caja.ts';
import type { Turno } from '../api.ts';
import { Ico } from './Ico.tsx';

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number | null }) {
  return (
    <div class="resumen-turno__cifra">
      <span>{etiqueta}</span>
      <strong>{valor === null ? '—' : pesos(valor)}</strong>
    </div>
  );
}

export function ResumenTurno({ turno, tipo, horario }: {
  turno: Turno | null;
  tipo: 'DIA' | 'NOCHE';
  /** «07:00 a. m. – 03:00 p. m.», ya armado por quien conoce el turno. */
  horario: string | null;
}) {
  const nombre = tipo === 'DIA' ? 'Turno día' : 'Turno noche';
  if (!turno) {
    return (
      <section class="tarjeta resumen-turno" aria-label={nombre}>
        <div class="resumen-turno__cab"><h3>{nombre}</h3></div>
        <p class="vacio">Todavía no hay ningún turno de este tipo registrado.</p>
      </section>
    );
  }
  const estado = estadoTurno(turno);
  const c = turno.caja;
  return (
    <section class="tarjeta resumen-turno" aria-label={nombre}>
      <div class="resumen-turno__cab">
        <span class={`resumen-turno__ico resumen-turno__ico--${tipo === 'DIA' ? 'dia' : 'noche'}`}>
          <Ico id={tipo === 'DIA' ? 'dona' : 'reloj'} clase="ico--s" />
        </span>
        <div>
          <h3>{nombre}</h3>
          {horario && <p>{horario}</p>}
        </div>
        <span class={`pill pill--${estado === 'Cerrado' ? 'neutro' : 'libre'}`}>{estado}</span>
      </div>
      <div class="resumen-turno__cifras">
        <Cifra etiqueta="Base recibida" valor={turno.base_recibida ?? c.base_recibida} />
        <Cifra etiqueta="Ingresos" valor={c.efectivo} />
        <Cifra etiqueta="Egresos" valor={c.salidas} />
      </div>
      <ul class="resumen-turno__cierre">
        <li><span>Efectivo esperado</span><strong>{pesos(turno.cierre ? turno.cierre.efectivo_esperado : c.debe_haber)}</strong></li>
        <li><span>Efectivo contado</span><strong>{turno.cierre ? pesos(turno.cierre.efectivo_contado) : '—'}</strong></li>
        <li class={turno.cierre && turno.cierre.diferencia !== 0 ? 'resumen-turno__dif' : undefined}>
          <span>Diferencia</span>
          <strong>{turno.cierre ? pesos(turno.cierre.diferencia) : '—'}</strong>
        </li>
      </ul>
    </section>
  );
}
