// Aviso de privacidad en la entrada (TICKET-28; FR-05, RN-16, ADR-006). El enfoque es la obligación legal: el registro de
// huéspedes (Tarjeta de Registro de Alojamiento, Ley 2068 de 2020, art. 22) y el reporte de extranjeros a Migración
// Colombia [V]. El texto corto lo aprobó la dueña el 18-10-2026 (HG-ACT-001 V6-09; HG-PRIV-001 v0.4). La parte legal la
// revisa un asesor. Los datos del hotel no van aquí, porque el código es público: salen de Ajustes (GET /hotel).
import { AVISO_VERSION } from './logica.ts';

export interface DatosHotel { responsable: string | null; nit: string | null; rnt: string | null; direccion: string | null; telefono: string | null }
export interface SeccionPolitica { titulo: string; parrafos: string[] }

/** Lo que recepción le dice al huésped al llegar (aprobado; HG-PRIV-001 v0.4 §1). */
export const TEXTO_CORTO = [
  'Para hospedarse, la ley nos exige registrar a cada huésped. Por eso necesitamos su nombre completo, su documento de identidad y su nacionalidad. Si usted es extranjero, también debemos reportar su llegada y su salida a Migración Colombia.',
  'Usamos estos datos solo para su registro, su cuenta y la seguridad del hotel. Si la policía pasa en su ronda, puede ver quiénes se hospedan esa noche. No los usamos para publicidad ni los compartimos con nadie más.',
  'Puede consultarlos, corregirlos o pedir que se borren hablando con la recepción del hotel. La política completa está aquí en recepción.',
  '¿Nos autoriza el tratamiento de sus datos?',
];

const NOMBRES: Record<keyof DatosHotel, string> = {
  responsable: 'el responsable', nit: 'el NIT', rnt: 'el Registro Nacional de Turismo', direccion: 'la dirección', telefono: 'el teléfono',
};

export function faltantesHotel(d: DatosHotel): string[] {
  return (Object.keys(NOMBRES) as Array<keyof DatosHotel>).filter((k) => !d[k]?.trim()).map((k) => NOMBRES[k]);
}

/** 3001234567 → «300 123 4567». */
export const textoTelefono = (t: string) => (t.length === 10 ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : t);

const FALTA = '(falta en Ajustes)';

/** La política completa, con los datos del hotel y el plazo de borrado configurado (`retencion_datos_dias`). */
export function politica(d: DatosHotel, retencionDias: number | null): SeccionPolitica[] {
  const v = (x: string | null) => x?.trim() || FALTA;
  const tel = d.telefono?.trim() ? textoTelefono(d.telefono.trim()) : FALTA;
  return [
    { titulo: '¿Quién es el responsable de sus datos?', parrafos: [
      `${v(d.responsable)}, Hotel Golán, Florencia (Caquetá). NIT ${v(d.nit)}. Registro Nacional de Turismo ${v(d.rnt)}.`,
      `Dirección: ${v(d.direccion)}. Teléfono y WhatsApp de la recepción: ${tel}.`,
    ] },
    { titulo: '¿Por qué le pedimos sus datos?', parrafos: [
      'Porque la ley lo exige. Todo hotel debe llevar el registro de sus huéspedes con la Tarjeta de Registro de Alojamiento del Ministerio de Comercio, Industria y Turismo, que también sirve como prueba de su contrato de hospedaje (Ley 2068 de 2020, art. 22).',
      'Si usted es extranjero, la ley también obliga al hotel a reportar su llegada y su salida a Migración Colombia (Decreto 1067 de 2015).',
    ] },
    { titulo: '¿Qué datos pedimos?', parrafos: [
      'Por ley: su nombre completo, el tipo y número de su documento de identidad, su nacionalidad y las fechas de entrada y salida. Si viene un menor de edad, con quién viene.',
      'Opcionales: su teléfono, para contactarlo durante la estadía. Si pide factura, su RUT o NIT y el correo o el celular donde quiere recibirla.',
    ] },
    { titulo: '¿Para qué más los usamos?', parrafos: [
      'Para llevar la cuenta de su habitación y atender sus solicitudes. Por seguridad: cuando la policía pasa en su ronda, recepción le muestra quiénes se hospedan esa noche; no se le envían ni se le entregan los datos.',
      'No los usamos para publicidad ni se los vendemos o pasamos a nadie más.',
    ] },
    { titulo: '¿Quién los ve?', parrafos: [
      'La recepción del turno y la administración, cada una con su propio usuario y clave; el Ministerio de Comercio, por la tarjeta de registro (al DANE solo le llegan cifras, sin nombres); Migración Colombia, si usted es extranjero; la policía, solo en su ronda; y el contador, solo el RUT, si pide factura.',
    ] },
    { titulo: '¿Cuánto tiempo los guardamos?', parrafos: [
      `Hoy el sistema borra su nombre, su documento y su teléfono ${retencionDias ?? FALTA} días después de su salida. El plazo está en revisión para cumplir lo que exija la ley. Lo que se cobró y se pagó se conserva sin su nombre, porque es la contabilidad del hotel.`,
    ] },
    { titulo: '¿Cómo los cuidamos?', parrafos: [
      'Cada persona del hotel entra con su propio usuario y clave. El sistema anota quién hizo cada cosa y cuándo, también cada vez que alguien abre datos personales completos.',
    ] },
    { titulo: '¿Qué derechos tiene y cómo pedirlos?', parrafos: [
      'Puede saber qué datos suyos tenemos, corregirlos, pedir que se borren o retirar su autorización (salvo los datos que la ley nos obliga a conservar) y pedir copia de esta autorización. Si no queda conforme, puede quejarse ante la Superintendencia de Industria y Comercio (Ley 1581 de 2012).',
      `Hable con la recepción, en persona o al ${tel}; la recepción se lo pasa a la dueña. Las consultas se responden en máximo 10 días hábiles (prorrogables 5) y los reclamos en máximo 15 días hábiles (prorrogables 8).`,
    ] },
    { titulo: '¿Y si no entrega los datos que pide la ley?', parrafos: [
      'Sin el nombre, el documento y la nacionalidad no podemos hacer el registro que exige la ley, y por eso no podemos hospedarlo.',
    ] },
    { titulo: 'Versión', parrafos: [`${AVISO_VERSION}. Texto aprobado por la administración; la parte legal está en revisión por un asesor.`] },
  ];
}

const soloDigitos = (s: string) => s.replace(/\D/g, '');

/** Validación del formulario de Ajustes; vacío se permite (queda «falta en Ajustes»). */
export function erroresDatosHotel(d: Record<keyof DatosHotel, string | null>): Partial<Record<keyof DatosHotel, string>> {
  const e: Partial<Record<keyof DatosHotel, string>> = {};
  const t = (x: string | null) => (x ?? '').trim();
  if (t(d.responsable) && t(d.responsable).length < 3) e.responsable = 'Escriba el nombre completo del responsable.';
  if (t(d.nit) && !/^[0-9.-]{5,20}$/.test(t(d.nit))) e.nit = 'El NIT lleva solo números, puntos y guion.';
  if (t(d.rnt) && !/^[0-9]{3,10}$/.test(t(d.rnt))) e.rnt = 'El Registro Nacional de Turismo lleva solo números.';
  if (t(d.direccion) && t(d.direccion).length < 5) e.direccion = 'Escriba la dirección completa.';
  if (t(d.telefono) && !/^[0-9]{7,10}$/.test(soloDigitos(t(d.telefono)))) e.telefono = 'El teléfono tiene 7 a 10 números.';
  return e;
}

/** Para la API: teléfono solo con números; los demás, sin espacios sobrantes. */
export function aDatosHotelInput(d: Record<keyof DatosHotel, string | null>): Record<keyof DatosHotel, string> {
  const t = (x: string | null) => (x ?? '').trim();
  return { responsable: t(d.responsable), nit: t(d.nit), rnt: t(d.rnt), direccion: t(d.direccion), telefono: soloDigitos(t(d.telefono)) };
}
