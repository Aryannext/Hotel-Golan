// Paneles abiertos, del de abajo al de encima (HG-HAL-001 HAL-13): Escape cierra solo el de encima, y el fondo se libera
// cuando ya no queda ninguno.

export interface PilaPaneles {
  /** Registra un panel con su forma de cerrarse; devuelve cómo quitarlo de la pila (al desmontarse). */
  abrir(cerrar: () => void): () => void;
  /** Cierra el panel de encima, si hay alguno. */
  escape(): void;
  abiertos(): number;
}

export function crearPila(): PilaPaneles {
  const paneles: Array<{ cerrar: () => void }> = [];
  return {
    abrir(cerrar) {
      const panel = { cerrar };
      paneles.push(panel);
      return () => {
        const i = paneles.indexOf(panel);
        if (i >= 0) paneles.splice(i, 1);
      };
    },
    escape() { paneles.at(-1)?.cerrar(); },
    abiertos: () => paneles.length,
  };
}
