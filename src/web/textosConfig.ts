// Textos de ayuda con importes que se configuran en Ajustes (TICKET-15): GET /reglas, GET /tarifas y el catálogo.
// Sin JSX, se prueba con node --test. Si el valor no se puede deducir con seguridad, el texto no lleva importe.
import type { Reglas, Tarifa } from './ajustes.ts';
import { pesos, type Modalidad, type Producto } from './logica.ts';

/** `null`: con descuento en $0 no hay rebaja que ofrecer. */
export function textoDescuento(reglas: Pick<Reglas, 'descuento_noche'> | null): string | null {
  if (!reglas) return 'Con descuento';
  return reglas.descuento_noche > 0 ? `− ${pesos(reglas.descuento_noche)} por noche` : null;
}

/** La única tarifa vigente de la combinación; si falta o hay más de una, no se adivina. */
function tarifaUnica(tarifas: Tarifa[], tipo: Tarifa['tipo_habitacion'], personas: number): number | null {
  const v = tarifas.filter((t) => t.tipo_habitacion === tipo && t.modalidad === 'NOCHE' && t.personas === personas);
  return v.length === 1 ? v[0].valor : null;
}

/** El adicional de la tercera persona es la diferencia entre las noches de 3 y de 2 personas del tipo de habitación. */
export function ayudaPersonas(modalidad: Modalidad, tipo: Tarifa['tipo_habitacion'], tarifas: Tarifa[] | null): string {
  if (modalidad === 'TRES_HORAS') return 'En tres horas entran máximo 2, sin adicional.';
  const dos = tarifas && tarifaUnica(tarifas, tipo, 2);
  const tres = tarifas && tarifaUnica(tarifas, tipo, 3);
  if (dos == null || tres == null || tres <= dos) return 'Máximo 3. Con 4, ofrezca dos habitaciones.';
  return `Máximo 3: la tercera paga ${pesos(tres - dos)}. Con 4, ofrezca dos habitaciones.`;
}

export function ayudaHoras(reglas: Pick<Reglas, 'valor_hora'> | null): string {
  return `${reglas ? `${pesos(reglas.valor_hora)} por hora empezada` : 'Se cobra la hora empezada'}, solo para extender. Sin descuento.`;
}

/** Precio del producto activo «Recargo aseo extremo»; si no está o está repetido, `null`. */
function recargoAseo(productos: Producto[] | null): number | null {
  const v = (productos ?? []).filter((p) => p.activo && p.nombre === 'Recargo aseo extremo');
  return v.length === 1 ? v[0].precio : null;
}

export function ayudaRecargoAseo(productos: Producto[] | null): string {
  const valor = recargoAseo(productos);
  return valor == null
    ? 'Si fue extremo (vómito, fluidos), al huésped se le cobra el recargo de aseo del catálogo y se le entrega a quien hace el aseo.'
    : `Si fue extremo (vómito, fluidos), al huésped se le cobran ${pesos(valor)} y se le entregan a quien hace el aseo.`;
}

export function avisoLimpiezaEspecial(numero: string, productos: Producto[] | null): string {
  const valor = recargoAseo(productos);
  return `Habitación ${numero} en limpieza especial. Recuerde: el recargo ${valor == null ? '' : `de ${pesos(valor)} `}se le entrega a quien limpió (salida de caja).`;
}
