// RN-15: fecha inicial del informe, independiente de la zona horaria del dispositivo.
export const diaHotelActual = (ahora = Date.now()) => new Date(ahora - (5 * 60 + 390) * 60_000).toISOString().slice(0, 10);
export const fechaReporte = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
export function errorRango(desde: string, hasta: string): string | null {
  const valida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!valida(desde) || !valida(hasta)) return 'Elija dos fechas válidas.';
  return desde > hasta ? 'La fecha inicial debe ser anterior o igual a la final.' : null;
}
