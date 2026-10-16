// Tiempo real (FR-15; ADR-005, ADR-011). El publicador lee la bandeja de salida (eventos_salida), envía cada evento por SSE
// a las sesiones conectadas y lo marca como publicado. Se despierta después de cada cambio y, de respaldo, cada segundo.
import type { FastifyInstance } from 'fastify';
import type { Bd } from '../../../scripts/lib/bd.ts';
import { requiere, type Rol } from '../identidad/sesiones.ts';
import { aBogota } from '../comun/tiempo.ts';

interface FilaEvento { id: string | number | bigint; tipo: string; payload: Record<string, unknown>; ocurrido_en: Date }
export interface Evento { id: string; tipo: string; ocurrido_en: string; habitacion_numero: string | null; entidad_id: string | null; valor: number | null }
interface Cliente { rol: Rol; ultimoId: bigint; enviar(texto: string): void }

/** Eventos que no ve recepción: el aviso de diferencia de caja es para la administración (FR-14). */
const SOLO_ADMINISTRACION = new Set(['turno.diferencia']);
const visible = (tipo: string, rol: Rol) => rol === 'ADMINISTRACION' || !SOLO_ADMINISTRACION.has(tipo);

/** Forma pública del evento (schema Evento): solo identificadores, habitación y valor; nunca datos personales. */
export function aEvento(f: FilaEvento): Evento {
  const p = f.payload;
  const texto = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    id: String(f.id), tipo: f.tipo, ocurrido_en: aBogota(new Date(f.ocurrido_en)),
    habitacion_numero: texto(p.habitacion_numero) ?? texto(p.numero),
    entidad_id: texto(p.entidad_id) ?? texto(p.turno_id),
    valor: typeof p.valor === 'number' ? p.valor : null,
  };
}

const mensaje = (ev: Evento) => `id: ${ev.id}\nevent: ${ev.tipo}\ndata: ${JSON.stringify(ev)}\n\n`;

export class Publicador {
  private readonly clientes = new Set<Cliente>();
  private readonly reloj: NodeJS.Timeout;
  private corriendo = false;
  private otraVez = false;
  private readonly bd: Bd;
  private readonly alFallar: (e: unknown) => void;

  constructor(bd: Bd, alFallar: (e: unknown) => void, intervaloMs = 1000) {
    this.bd = bd;
    this.alFallar = alFallar;
    this.reloj = setInterval(() => this.despertar(), intervaloMs);
    this.reloj.unref();
  }

  /** Publica lo pendiente; si ya está publicando, vuelve a pasar al terminar. */
  despertar(): void {
    if (this.corriendo) { this.otraVez = true; return; }
    this.corriendo = true;
    this.publicar().catch(this.alFallar).finally(() => {
      this.corriendo = false;
      if (this.otraVez) { this.otraVez = false; this.despertar(); }
    });
  }

  private async publicar(): Promise<void> {
    const filas = await this.bd.consultar<FilaEvento>(
      'SELECT id, tipo, payload, ocurrido_en FROM eventos_salida WHERE publicado_en IS NULL ORDER BY id LIMIT 200');
    if (filas.length === 0) return;
    for (const f of filas) this.difundir(aEvento(f));
    await this.bd.consultar('UPDATE eventos_salida SET publicado_en = now() WHERE id = ANY($1::bigint[])', [filas.map((f) => String(f.id))]);
    if (filas.length === 200) this.otraVez = true;
  }

  private difundir(ev: Evento): void {
    for (const c of this.clientes) this.entregar(c, ev);
  }

  /** Cada cliente recibe un evento una sola vez y en orden (los ids crecen). */
  private entregar(c: Cliente, ev: Evento): void {
    const id = BigInt(ev.id);
    if (id <= c.ultimoId || !visible(ev.tipo, c.rol)) return;
    c.ultimoId = id;
    c.enviar(mensaje(ev));
  }

  /** Suscribe primero y después repite lo perdido desde Last-Event-ID, para no dejar huecos entre ambos pasos. */
  async suscribir(c: Cliente, desde: bigint | null): Promise<() => void> {
    this.clientes.add(c);
    if (desde !== null) {
      const filas = await this.bd.consultar<FilaEvento>(
        'SELECT id, tipo, payload, ocurrido_en FROM eventos_salida WHERE id > $1::bigint ORDER BY id LIMIT 500', [String(desde)]);
      for (const f of filas) this.entregar(c, aEvento(f));
    }
    return () => this.clientes.delete(c);
  }

  cerrar(): void {
    clearInterval(this.reloj);
    this.clientes.clear();
  }
}

export function rutasEventos(app: FastifyInstance, bd: Bd, ahora: () => Date, publicador: Publicador, conexiones: Set<() => void>) {
  app.get<{ Headers: { 'last-event-id'?: string } }>('/eventos', {
    preHandler: requiere(bd, ahora, ['RECEPCION', 'ADMINISTRACION']),
  }, async (req, rep) => {
    const ultimo = req.headers['last-event-id'];
    const desde = ultimo && /^\d{1,19}$/.test(ultimo) ? BigInt(ultimo) : null;
    rep.hijack();
    const res = rep.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive', 'x-accel-buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    const latido = setInterval(() => res.write(': latido\n\n'), 25_000);
    latido.unref();
    let quitar = () => {};
    const cerrar = () => { clearInterval(latido); quitar(); conexiones.delete(cerrar); res.end(); };
    conexiones.add(cerrar);
    req.raw.on('close', cerrar);
    quitar = await publicador.suscribir({ rol: req.usuario!.rol, ultimoId: desde ?? 0n, enviar: (t) => res.write(t) }, desde);
  });
}
