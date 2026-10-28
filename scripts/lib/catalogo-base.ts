// Catálogo base del hotel: lo usan la semilla de desarrollo y el arranque de una base nueva (HG-HAL-001 HAL-02).
// Habitaciones, tarifas y reglas: docs/PRD.md §4.1 (fuente HG-ACT-001). Precios informados: HG-LEV-001 §§8–9.
// La administración los cambia después en Ajustes; no son datos de huéspedes.

export const HABITACIONES: Array<[string, 'AIRE' | 'VENTILADOR']> = [
  ['201', 'AIRE'], ['202', 'AIRE'], ['203', 'AIRE'], ['204', 'AIRE'], ['205', 'VENTILADOR'], ['206', 'VENTILADOR'],
  ['207', 'VENTILADOR'], ['208', 'VENTILADOR'], ['209', 'VENTILADOR'], ['210', 'VENTILADOR'], ['211', 'VENTILADOR'], ['301', 'AIRE'],
];

// RN-02 y RN-03. Tres horas: una sola fila (personas = 2) que vale para 1 o 2 personas.
export const TARIFAS: Array<[string, string, number, number]> = [
  ['VENTILADOR', 'NOCHE', 1, 45000], ['VENTILADOR', 'NOCHE', 2, 55000], ['VENTILADOR', 'NOCHE', 3, 80000],
  ['AIRE', 'NOCHE', 1, 60000], ['AIRE', 'NOCHE', 2, 70000], ['AIRE', 'NOCHE', 3, 95000],
  ['VENTILADOR', 'TRES_HORAS', 2, 25000], ['AIRE', 'TRES_HORAS', 2, 35000],
];

// Las reglas que agregan las migraciones 0007 y 0009 (cambio de habitación, reporte a Migración) las insertan ellas.
export const REGLAS: Array<[string, number]> = [
  ['valor_hora', 8000], ['hora_noche_completa', 16], ['descuento_noche', 5000],
  ['pago_turno_dia', 70000], ['pago_turno_noche', 50000], ['retencion_datos_dias', 90],
];

// Precios informados (HG-LEV-001 §§8–9; HG-ACT-001 T2-18). La vitrina la carga la administración en Ajustes.
export const PRODUCTOS: Array<[string, string, number]> = [
  ['Coca-Cola', 'NEVERA', 4000], ['Agua', 'NEVERA', 2500], ['Hit', 'NEVERA', 3500], ['Sáviloe', 'NEVERA', 4000],
  ['Gatorade', 'NEVERA', 5000], ['Squash', 'NEVERA', 4000], ['Pony Malta', 'NEVERA', 3500],
  ['Buso', 'LAVANDERIA', 2000], ['Pantalón', 'LAVANDERIA', 3000], ['Vestido', 'LAVANDERIA', 4000],
  ['Toalla', 'LAVANDERIA', 3000], ['Sábana', 'LAVANDERIA', 4000], ['Cobija', 'LAVANDERIA', 5000],
  ['Llave perdida', 'OTROS', 40000], ['Recargo aseo extremo', 'OTROS', 20000],
];
