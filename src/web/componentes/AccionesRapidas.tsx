// Inicio de recepción más simple: lo que se hace a diario sin estar en una habitación, a un toque y con su nombre.
// Antes estaba dentro de la pestaña Caja y nadie lo encontraba (usuario, 19-10-2026). La Caja conserva los mismos botones.
import { useState } from 'preact/hooks';
import { api, ErrorApi } from '../api.ts';
import { Ico } from './Ico.tsx';
import { VentaContado } from './VentaContado.tsx';
import { LavanderiaExterna } from './LavanderiaExterna.tsx';
import { SalidaDinero } from './SalidaDinero.tsx';
import { QuienesHoy } from './QuienesHoy.tsx';

type Accion = 'vender' | 'lavanderia' | 'salio' | 'hoy';

const BOTONES: Array<{ accion: Accion; ico: string; titulo: string; detalle: string }> = [
  { accion: 'vender', ico: 'vitrina', titulo: 'Vender', detalle: 'Nevera y vitrina' },
  { accion: 'lavanderia', ico: 'lavanderia', titulo: 'Lavandería', detalle: 'Ropa de afuera' },
  { accion: 'salio', ico: 'baja', titulo: 'Salió plata', detalle: 'De la caja' },
  { accion: 'hoy', ico: 'huespedes', titulo: 'Quiénes hoy', detalle: 'Para la policía' },
];

export function AccionesRapidas({ alAvisar, alCambiar }: { alAvisar: (texto: string, tono?: 'exito' | 'info') => void; alCambiar: () => void }) {
  const [abierta, setAbierta] = useState<Accion | null>(null);
  const [debeHaber, setDebeHaber] = useState(0);
  const cerrar = () => setAbierta(null);
  const listo = (texto: string) => { cerrar(); alCambiar(); alAvisar(texto); };

  async function abrir(accion: Accion) {
    if (accion === 'salio') {
      // «Salió plata» muestra cuánto debe haber en la caja: se lee del turno abierto.
      try { setDebeHaber((await api.turnoActual()).caja.debe_haber); }
      catch (e) {
        alAvisar(e instanceof ErrorApi && e.estado === 404 ? 'No hay un turno abierto: reciba el turno antes de sacar plata de la caja.' : 'No se pudo abrir la caja. Revise la conexión.', 'info');
        return;
      }
    }
    setAbierta(accion);
  }

  return <>
    <nav class="rapidas" aria-label="Acciones del día">
      {BOTONES.map((b) => <button key={b.accion} type="button" class="rapida" onClick={() => void abrir(b.accion)}>
        <span class="rapida__ico"><Ico id={b.ico} /></span>
        <span class="rapida__titulo">{b.titulo}</span>
        <span class="rapida__detalle">{b.detalle}</span>
      </button>)}
    </nav>
    {abierta === 'vender' && <VentaContado alCerrar={cerrar} alRegistrar={listo} />}
    {abierta === 'lavanderia' && <LavanderiaExterna alCerrar={cerrar} alRegistrar={listo} />}
    {abierta === 'salio' && <SalidaDinero debeHaber={debeHaber} alCerrar={cerrar} alRegistrar={listo} />}
    {abierta === 'hoy' && <QuienesHoy alCerrar={cerrar} />}
  </>;
}
