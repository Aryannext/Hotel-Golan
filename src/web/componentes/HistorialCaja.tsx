import { useEffect, useState } from 'preact/hooks';
import { api, type Turno } from '../api.ts';
import { filaTurno } from '../caja.ts';
import { HistorialTurnos } from './HistorialTurnos.tsx';
import { Panel } from './Panel.tsx';

export function HistorialCaja({ alCerrar }: { alCerrar: () => void }) {
  const [filas, setFilas] = useState<Turno[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api.turnos(pagina * 50, 50).then((r) => {
      if (!vigente) return;
      setFilas((anteriores) => pagina === 0 ? r.items : [...anteriores, ...r.items]);
      setTotal(r.total);
    }).catch(() => {
      if (vigente) setError('No se pudo cargar el historial. Intenta nuevamente.');
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [pagina, intento]);
  return <Panel titulo="Historial de caja" alCerrar={alCerrar} error={error}>
    <div class="historial-caja" aria-busy={cargando}>
      {(!cargando || filas.length > 0) && <HistorialTurnos filas={filas.map(filaTurno)} />}
      <p class="ayuda" role="status">{cargando ? 'Cargando turnos…' : `Mostrando ${filas.length} de ${total} turnos registrados.`}</p>
      {!cargando && !error && total === 1 && <p class="ayuda">Este es el único turno registrado en el sistema.</p>}
      {error ? <button class="btn btn--secundario" onClick={() => setIntento(intento + 1)}>Reintentar</button>
        : filas.length < total && <button class="btn btn--secundario btn--bloque" disabled={cargando} onClick={() => setPagina(pagina + 1)}>Cargar más turnos</button>}
      <p class="ayuda">Informes avanzados: entrega futura.</p>
    </div>
  </Panel>;
}
