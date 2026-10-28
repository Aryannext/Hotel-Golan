// Lógica de presentación sin JSX; la usan los componentes y se prueba con node --test.
const CLASES: Record<string, string> = {
  DISPONIBLE: 'libre', OCUPADA: 'ocupada', POR_REVISAR: 'revisar', LIMPIEZA: 'limpieza', MANTENIMIENTO: 'fuera',
};
const TEXTOS: Record<string, string> = {
  DISPONIBLE: 'Disponible', OCUPADA: 'Ocupada', POR_REVISAR: 'Por revisar', LIMPIEZA: 'Limpieza', MANTENIMIENTO: 'Mantenimiento',
};

export const claseEstado = (estado: string) => CLASES[estado] ?? 'libre';
export const textoEstado = (estado: string) => TEXTOS[estado] ?? estado;

export function pesos(n: number): string {
  const r = Math.round(n);
  const digitos = Math.abs(r).toString();
  const grupos: string[] = [];
  for (let fin = digitos.length; fin > 0; fin -= 3) grupos.unshift(digitos.slice(Math.max(0, fin - 3), fin));
  return `$${r < 0 ? '-' : ''}${grupos.join('.')}`;
}

/** Lee la hora directamente del texto ISO con -05:00, para no depender de la zona horaria del equipo. */
export function horaBogota(iso: string): string {
  const [hh, mm] = iso.slice(11, 16).split(':').map(Number);
  if (hh === 12 && mm === 0) return '12:00 m.';
  const sufijo = hh < 12 ? 'a. m.' : 'p. m.';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${sufijo}`;
}

/** «hoy», «mañana» o «dd/mm», comparando con la fecha de referencia (AAAA-MM-DD, en Bogotá). */
export function diaRelativo(iso: string, hoy: string): string {
  const fecha = iso.slice(0, 10);
  if (fecha === hoy) return 'hoy';
  const manana = new Date(Date.parse(hoy + 'T00:00:00Z') + 86_400_000).toISOString().slice(0, 10);
  if (fecha === manana) return 'mañana';
  const ayer = new Date(Date.parse(hoy + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
  if (fecha === ayer) return 'ayer';
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

export function contarEstados(items: Array<{ estado: string }>) {
  const n = (...e: string[]) => items.filter((h) => e.includes(h.estado)).length;
  return { disponibles: n('DISPONIBLE'), ocupadas: n('OCUPADA'), limpiezaORevision: n('LIMPIEZA', 'POR_REVISAR'), mantenimiento: n('MANTENIMIENTO') };
}

/** Fecha de hoy en Bogotá (UTC−5), AAAA-MM-DD. */
export const hoyBogota = (ahora = Date.now()) => new Date(ahora - 5 * 3_600_000).toISOString().slice(0, 10);

/** Dos iniciales para el avatar: «Recepción Prueba 2» → «RP». */
export const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export type Modalidad = 'NOCHE' | 'TRES_HORAS';

/** RN-02 / RN-03: máximo 3 personas por noche y 2 en tres horas. */
export const maxPersonas = (m: Modalidad) => (m === 'TRES_HORAS' ? 2 : 3);
export const ajustarPersonas = (personas: number, m: Modalidad) => Math.min(maxPersonas(m), Math.max(1, personas));

/** «mañana a las 12:00 m.», «hoy a la 1:30 a. m.» (en español se dice «a la una»). */
export function textoSalida(iso: string, hoy: string): string {
  const hora = horaBogota(iso);
  return `${diaRelativo(iso, hoy)} ${hora.startsWith('1:') ? 'a la' : 'a las'} ${hora}`;
}

// TICKET-03 · recibir el turno y caja.
/** Lee lo que escribe recepción («184.500», «$ 183000»); sin números devuelve null. */
export function leerPesos(texto: string): number | null {
  const d = texto.replace(/\D/g, '');
  return d ? Number(d) : null;
}

export function diferenciaConteo(contado: number, entregado: number): { tono: 'exito' | 'alerta'; texto: string } {
  const d = contado - entregado;
  if (d === 0) return { tono: 'exito', texto: 'Sin diferencia' };
  return { tono: 'alerta', texto: `${d < 0 ? 'Faltan' : 'Sobran'} ${pesos(Math.abs(d))}` };
}

export const nombreTurno = (tipo: 'DIA' | 'NOCHE') =>
  tipo === 'DIA' ? 'de día · 6:30 a. m. a 6:30 p. m.' : 'de noche · 6:30 p. m. a 6:30 a. m.';

// TICKET-04 · asistente de entrada.
/** Versión vigente del aviso de privacidad que el huésped autoriza (la aprueba la administradora) [P/V]. */
export const AVISO_VERSION = 'AV-2026-10';
export const TIPOS_DOCUMENTO = [['CC', 'Cédula'], ['CE', 'Cédula de extranjería'], ['PASAPORTE', 'Pasaporte'], ['PPT', 'Permiso (PPT)'], ['TI', 'Tarjeta de identidad'], ['RC', 'Registro civil']] as const;

export interface FormHuesped {
  nombre: string; tipoDocumento: string; numeroDocumento: string; nacionalidad: string; telefono: string;
  esMenor: boolean; acompanante: boolean; autorizo: boolean;
}
export const HUESPED_VACIO: FormHuesped = {
  nombre: '', tipoDocumento: '', numeroDocumento: '', nacionalidad: 'Colombia', telefono: '', esMenor: false, acompanante: false, autorizo: false,
};

/** DEF-002: «Volver» o «Cancelar» preguntan antes de borrar lo escrito, y solo si hay algo escrito. */
export const PREGUNTA_SALIR_ENTRADA = '¿Salir sin registrar la entrada? Si sale, se borra lo que escribió.';
export function entradaEmpezada(h: FormHuesped, paso: number): boolean {
  return paso > 1 || [h.nombre, h.numeroDocumento, h.telefono].some((x) => x.trim() !== '');
}

const soloDocumento = (s: string) => s.replace(/[.\s]/g, '');
const digitos = (s: string) => s.replace(/\D/g, '');

/**
 * BD-18 (decisión del usuario, 27-10-2026): celular colombiano (10 números que empiezan por 3; se le agrega +57) o de
 * otro país (+ y el código del país, de 7 a 15 dígitos). Devuelve el número en formato internacional, o null.
 */
export function telefonoNormalizado(texto: string): string | null {
  const t = texto.trim();
  const d = digitos(t);
  if (t.startsWith('+')) return /^\+[\d\s().-]+$/.test(t) && /^[1-9]\d{6,14}$/.test(d) ? `+${d}` : null;
  return /^3\d{9}$/.test(d) ? `+57${d}` : null;
}

export function erroresHuesped(h: FormHuesped): Partial<Record<keyof FormHuesped, string>> {
  const e: Partial<Record<keyof FormHuesped, string>> = {};
  if (h.nombre.trim().length < 3) e.nombre = 'Escriba el nombre del titular.';
  // TICKET-36: el documento es obligatorio; lo pide el registro de huéspedes de la ley.
  if (!h.tipoDocumento || !h.numeroDocumento.trim()) e.numeroDocumento = 'Escriba el documento: lo pide la ley para registrar al huésped.';
  else if (!/^[A-Za-z0-9-]{4,20}$/.test(soloDocumento(h.numeroDocumento))) e.numeroDocumento = 'Escriba el número del documento (mínimo 4 caracteres).';
  if (h.nacionalidad.trim().length < 2) e.nacionalidad = 'Escriba la nacionalidad.';
  if (h.telefono.trim() && !telefonoNormalizado(h.telefono)) {
    e.telefono = 'Un celular colombiano tiene 10 números y empieza por 3. Uno de otro país empieza por + y el código del país (por ejemplo +58).';
  }
  if (h.esMenor && !h.acompanante) e.acompanante = 'Un menor solo entra con su acompañante verificado.';
  if (!h.autorizo) e.autorizo = 'Sin la autorización del huésped no se puede registrar la entrada.';
  return e;
}

export function aHuespedInput(h: FormHuesped) {
  return {
    nombre: h.nombre.trim(), nacionalidad: h.nacionalidad.trim(), es_menor: h.esMenor,
    ...(h.esMenor ? { acompanante_verificado: h.acompanante } : {}),
    tipo_documento: h.tipoDocumento, numero_documento: soloDocumento(h.numeroDocumento),
    ...(h.telefono.trim() ? { telefono: telefonoNormalizado(h.telefono) ?? '' } : {}),
  };
}

/** Con el efectivo recibido: vueltas si sobra, abono si falta. */
export function cambioEfectivo(total: number, recibido: number): { tipo: 'vueltas' | 'exacto' | 'abono'; valor: number } {
  if (recibido > total) return { tipo: 'vueltas', valor: recibido - total };
  if (recibido < total) return { tipo: 'abono', valor: total - recibido };
  return { tipo: 'exacto', valor: 0 };
}

export const enmascarar = (doc: string) => {
  const d = soloDocumento(doc);
  return d ? '••••' + d.slice(-3) : '';
};

/** UUID v4 para la Idempotency-Key. `crypto.randomUUID` solo existe en conexiones seguras; si no, se arma con getRandomValues. */
export function nuevaClave(c: Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string } = crypto): string {
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// TICKET-05 · pagos por confirmar y avisos en vivo.
export const textoMedio = (m: string) => ({ EFECTIVO: 'Efectivo', NEQUI: 'Nequi', BANCOLOMBIA: 'Bancolombia' } as Record<string, string>)[m] ?? m;

export interface EventoVivo { id: string; tipo: string; ocurrido_en: string; habitacion_numero: string | null; entidad_id: string | null; valor: number | null }

/** Aviso en palabras para los eventos de transferencias; los demás solo refrescan la pantalla. */
export function avisoEvento(ev: EventoVivo): { tono: 'exito' | 'alerta' | 'info'; texto: string } | null {
  const valor = pesos(ev.valor ?? 0);
  // Sin habitación es una venta de contado (TICKET-22): no hay salida antes de la cual cobrar.
  const de = ev.habitacion_numero ? `de la habitación ${ev.habitacion_numero}` : 'de una venta de contado';
  const siNoLlego = ev.habitacion_numero ? ': cóbrela de nuevo antes de la salida.' : '. Avise a la administración.';
  if (ev.tipo === 'pago.verificado') return { tono: 'exito', texto: `Llegó la transferencia de ${valor} ${de}.` };
  if (ev.tipo === 'pago.rechazado') return { tono: 'alerta', texto: `La transferencia de ${valor} ${de} NO llegó${siNoLlego}` };
  if (ev.tipo === 'pago.por_verificar') return { tono: 'info', texto: `Nueva transferencia por confirmar: ${valor} ${de}.` };
  // TICKET-31: solo el registro tardío en un turno entregado trae habitación; la diferencia de una entrega o un recibo, no.
  if (ev.tipo === 'turno.diferencia' && ev.habitacion_numero) {
    return { tono: 'info', texto: `Se pasó al sistema una entrada del talonario (habitación ${ev.habitacion_numero}, ${valor}) en un turno ya entregado. Revise su diferencia en el Historial.` };
  }
  return null;
}

// TICKET-06 · ficha de la habitación: cargos y pagos.
export interface Producto { id: string; nombre: string; grupo: string; precio: number; seccion: number | null; pertenece_a: string; activo: boolean }
export interface Cuenta { total_cargos: number; pagado: number; por_verificar: number; saldo: number; a_favor: number }

/** Grupos del catálogo, en el orden en que se muestran (FR-24). La sección 1 de la vitrina no va en el sistema (RN-13). */
export const GRUPOS: Array<[string, string]> = [
  ['NEVERA', 'Nevera'], ['VITRINA_PASABOCAS', 'Vitrina de pasabocas'], ['VITRINA_ASEO', 'Vitrina de aseo'],
  ['LAVANDERIA', 'Lavandería'], ['OTROS', 'Llave, aseo y otros'],
];

export function agruparCatalogo(productos: Producto[]): Array<[string, Producto[]]> {
  return GRUPOS.map(([g, t]) => [t, productos.filter((p) => p.grupo === g)] as [string, Producto[]]).filter(([, ps]) => ps.length > 0);
}

export function resumenSeleccion(productos: Producto[], cantidades: Record<string, number>) {
  const items = productos.filter((p) => (cantidades[p.id] ?? 0) > 0)
    .map((p) => ({ producto: p, cantidad: cantidades[p.id], subtotal: p.precio * cantidades[p.id] }));
  return { items, total: items.reduce((s, x) => s + x.subtotal, 0) };
}

export function estadoSaldo(c: Cuenta): { tono: 'alerta' | 'aviso' | 'ok'; titulo: string; detalle: string; valor: number } {
  if (c.saldo > 0) return { tono: 'alerta', titulo: 'Debe', detalle: c.por_verificar ? `Además hay ${pesos(c.por_verificar)} por verificar` : 'Saldo pendiente', valor: c.saldo };
  if (c.por_verificar > 0) return { tono: 'aviso', titulo: 'Por verificar', detalle: 'Queda al día cuando la administración confirme la transferencia', valor: c.por_verificar };
  return { tono: 'ok', titulo: 'Al día', detalle: 'No debe nada', valor: 0 };
}

/** En efectivo se cobra hasta el saldo y lo que sobra se devuelve; una transferencia se registra por lo que llegó. */
export function valorPago(medio: string, saldo: number, escrito: number): { valor: number; vueltas: number } {
  if (medio !== 'EFECTIVO') return { valor: escrito, vueltas: 0 };
  return { valor: Math.min(escrito, saldo), vueltas: Math.max(0, escrito - saldo) };
}

// TICKET-08 · revisión de la habitación (FR-02): lo que se puede hacer según el estado.
export interface AccionEstado { estado: 'DISPONIBLE' | 'POR_REVISAR' | 'LIMPIEZA' | 'MANTENIMIENTO'; texto: string; icono: string; especial?: boolean; pideNota?: boolean }
export function accionesEstado(estado: string): AccionEstado[] {
  if (estado === 'POR_REVISAR') return [
    { estado: 'LIMPIEZA', texto: 'Limpieza normal', icono: 'escoba' },
    { estado: 'LIMPIEZA', texto: 'Limpieza especial (fluidos o manchas)', icono: 'alerta', especial: true },
    { estado: 'MANTENIMIENTO', texto: 'Daño: mantenimiento', icono: 'herramienta', pideNota: true },
  ];
  if (estado === 'LIMPIEZA') return [{ estado: 'DISPONIBLE', texto: 'Limpia y revisada', icono: 'check' }];
  if (estado === 'MANTENIMIENTO') return [{ estado: 'POR_REVISAR', texto: 'Ya está arreglada', icono: 'check' }];
  return [];
}

// TICKET-10 · salidas de dinero (FR-12) y «Lo de este turno».
export const TIPOS_SALIDA = [
  { tipo: 'COMPRA_HOTEL', texto: 'Compra para el hotel', ejemplo: 'Ej. 2 jabones y un bombillo', valor: 0 },
  { tipo: 'RETIRO_ADMINISTRACION', texto: 'Se lo lleva la administración', ejemplo: 'Ej. para pagar servicios', valor: 0 },
  { tipo: 'RECARGO_ASEO', texto: 'Recargo de aseo a quien limpió', ejemplo: 'Ej. limpieza extrema', valor: 20000 },
  { tipo: 'OTRO', texto: 'Otro', ejemplo: 'Explique para qué fue', valor: 0 },
] as const;
export type TipoSalida = typeof TIPOS_SALIDA[number]['tipo'];
const TEXTO_SALIDA: Record<string, string> = { ...Object.fromEntries(TIPOS_SALIDA.map((t) => [t.tipo, t.texto])), DEVOLUCION: 'Devolución a un cliente' };

/** Cobro del turno: de una habitación o de una venta de contado (`venta_detalle`, TICKET-22). */
export interface PagoTurno { id: string; habitacion_numero: string | null; venta_detalle?: string | null; lavanderia_cliente?: string | null; medio: string; valor: number; estado: string; registrado_en: string; registrado_por: string; anulado: boolean }
export interface SalidaTurno { id: string; tipo: string; detalle: string; valor: number; habitacion_numero: string | null; registrado_en: string; registrado_por: string; anulado: boolean }
export interface LineaTurno {
  id: string; hora: string; concepto: string; valor: number; enCaja: boolean; estado: string; por: string; anulado: boolean;
  origen: 'PAGO' | 'SALIDA'; devolucion: boolean;
}

function conceptoSalida(m: SalidaTurno): string {
  const hab = m.habitacion_numero ? ` · Hab. ${m.habitacion_numero}` : '';
  return `${TEXTO_SALIDA[m.tipo] ?? m.tipo} · ${m.detalle}${hab}`;
}

function origenCobro(p: PagoTurno): string {
  if (p.habitacion_numero) return `Cobro · Hab. ${p.habitacion_numero}`;
  if (p.lavanderia_cliente) return `Lavandería · ${p.lavanderia_cliente}`;
  return `Venta de contado · ${p.venta_detalle ?? ''}`;
}

function conceptoCobro(p: PagoTurno): string {
  return `${origenCobro(p)} · ${textoMedio(p.medio)}`;
}

/** Cobros (suman) y salidas (restan) del turno, por hora. Solo el efectivo y las salidas mueven la caja. */
export function lineasDelTurno(pagos: PagoTurno[], salidas: SalidaTurno[]): LineaTurno[] {
  return [
    ...pagos.map((p) => ({ id: p.id, hora: p.registrado_en, concepto: conceptoCobro(p), valor: p.valor, enCaja: p.medio === 'EFECTIVO', estado: p.estado, por: p.registrado_por, anulado: p.anulado, origen: 'PAGO' as const, devolucion: false })),
    ...salidas.map((m) => ({ id: m.id, hora: m.registrado_en, concepto: conceptoSalida(m), valor: -m.valor, enCaja: true, estado: 'SALIDA', por: m.registrado_por, anulado: m.anulado, origen: 'SALIDA' as const, devolucion: m.tipo === 'DEVOLUCION' })),
  ].sort((a, b) => a.hora.localeCompare(b.hora));
}

// TICKET-11 · entregar el turno (FR-13; RN-11).
export const debeDejar = (debeHaber: number, pagoTurno: number, pagoTomado: boolean) => debeHaber - (pagoTomado ? pagoTurno : 0);

/** Aviso (no bloquea) si se entrega más de 60 minutos antes del fin programado: 6:30 a. m. o 6:30 p. m. */
export function avisoTemprano(finIso: string, ahora = Date.now()): string | null {
  if (Date.parse(finIso) - ahora <= 60 * 60_000) return null;
  // La hora ya termina en punto («a. m.»): no se agrega otro.
  return `Su turno termina ${diaRelativo(finIso, hoyBogota(ahora))} a las ${horaBogota(finIso)} Entregue solo cuando llegue quien lo recibe.`;
}

// TICKET-07 · extender la estadía (RN-04).
export interface CotizacionExtension { modalidad_cobrada: string; valor: number; salida_prevista_en: string; pasa_de_las_4: boolean }
export function resumenExtension(c: CotizacionExtension, hoy: string): { aviso: string | null; salida: string } {
  return { aviso: c.pasa_de_las_4 ? 'Pasaría de las 4:00 p. m.: se cobra la noche completa.' : null, salida: textoSalida(c.salida_prevista_en, hoy) };
}

// TICKET-09 · desistimiento y devolución (RN-08). Es la misma regla que aplica el servidor; aquí solo se anticipa.
export function devolucionPosible(pagos: Array<{ medio: string; valor: number; estado: string; anulado: boolean }>, motivo: 'SOLO_MIRO' | 'YA_USO', esAdmin: boolean) {
  const vigentes = pagos.filter((p) => !p.anulado);
  const efectivo = vigentes.filter((p) => p.estado === 'EN_CAJA').reduce((s, p) => s + p.valor, 0);
  const transferencias = vigentes.filter((p) => p.estado === 'VERIFICADO').reduce((s, p) => s + p.valor, 0);
  if (motivo === 'YA_USO') return { valor: 0, bloqueo: null };
  if (vigentes.some((p) => p.estado === 'POR_VERIFICAR')) {
    return { valor: 0, bloqueo: 'Pagó por transferencia y todavía no se ha confirmado. Espere a que la administración la verifique.' };
  }
  if (transferencias > 0 && !esAdmin) return { valor: efectivo + transferencias, bloqueo: 'Pagó por transferencia: la devolución la decide la administración.' };
  return { valor: efectivo + transferencias, bloqueo: null };
}

// TICKET-12 · anulaciones (FR-17): solo la administración, sobre lo vigente; una devolución va ligada a su estadía.
export const puedeAnular = (l: { anulado: boolean; devolucion?: boolean }, esAdmin: boolean) => esAdmin && !l.anulado && !l.devolucion;
