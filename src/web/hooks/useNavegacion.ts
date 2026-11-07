// En qué vista está la pantalla. Incluye con qué sección abre Configuración, porque
// un aviso de existencias lleva directo a esa sección y no a la de tarifas.
import { useEffect, useState } from 'preact/hooks';
import type { Seccion } from '../componentes/Ajustes.tsx';

export type Vista = 'inicio' | 'confirmar' | 'mapa' | 'caja' | 'historial' | 'equipo' | 'ajustes';

export interface Navegacion {
  vista: Vista;
  /** Sección con la que abre Configuración la próxima vez. */
  ajustesInicial: Seccion;
  irA: (v: Vista) => void;
  /** Abre Configuración directamente en una sección (desde un aviso). */
  abrirAjustes: (seccion: Seccion) => void;
}

export function useNavegacion(usuarioId: string | undefined): Navegacion {
  const [vista, setVista] = useState<Vista>('inicio');
  const [ajustesInicial, setAjustesInicial] = useState<Seccion>('tarifas');

  // Al entrar, o al entrar otra persona, siempre se empieza en el inicio.
  useEffect(() => { if (usuarioId) setVista('inicio'); }, [usuarioId]);

  return {
    vista,
    ajustesInicial,
    irA: setVista,
    abrirAjustes: (seccion) => { setAjustesInicial(seccion); setVista('ajustes'); },
  };
}
