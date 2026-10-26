// Barra lateral de navegación en computador (desde 1024 px). El estilo ya venía del prototipo
// en estilos.css (.lateral, .nav, .lateral__pie); aquí se dibuja el marcado que ese CSS espera.
import { Ico } from './Ico.tsx';

export interface OpcionLateral<V> { vista: V; texto: string; ico: string; cuenta?: number }

export function Lateral<V extends string>({ opciones, vista, alElegir, nombre, iniciales, rol, alSalir }: {
  opciones: Array<OpcionLateral<V>>;
  vista: V;
  alElegir: (v: V) => void;
  nombre: string;
  iniciales: string;
  rol: string;
  alSalir: () => void;
}) {
  return (
    <aside class="lateral" aria-label="Navegación principal">
      <div class="logo">
        <svg class="logo__svg" role="img" aria-label="Hotel Golán"><use href="#logo-golan-menu" /></svg>
        <p class="logo__sub">{rol === 'Administración' ? 'SISTEMA ADMINISTRATIVO' : 'SISTEMA DE RECEPCIÓN'}</p>
        <div class="logo__barra" aria-hidden="true" />
      </div>
      <nav class="nav">
        {opciones.map((o) => (
          <button key={o.vista} type="button" class="nav__item" aria-current={vista === o.vista ? 'page' : undefined}
            onClick={() => alElegir(o.vista)}>
            <Ico id={o.ico} clase="ico--s" />
            {o.texto}
            {o.cuenta ? <span class="nav__cuenta" aria-label={`${o.cuenta} por confirmar`}>{o.cuenta}</span> : null}
          </button>
        ))}
      </nav>
      <div class="lateral__pie">
        {/* Quién tiene el turno, con el punto de «en línea» (BOCETO 03). */}
        <div class="usuario">
          <span class="avatar" aria-hidden="true">{iniciales}</span>
          <span>
            <strong title={nombre}>{rol}</strong>
            <span class="usuario__estado"><span class="usuario__punto" aria-hidden="true" />En línea</span>
          </span>
        </div>
        <button type="button" class="nav__item lateral__salir" onClick={alSalir}><Ico id="salida" clase="ico--s" />Cerrar sesión</button>
      </div>
    </aside>
  );
}
