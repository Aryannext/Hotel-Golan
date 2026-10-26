// Pruebas de humo, seguridad y rendimiento contra el entorno en marcha (CF35, casos CP-037 a CP-041).
// No registra entradas ni cobros: solo inicia sesión y consulta. Usa los usuarios y el PIN de la semilla sintética.
// Uso: node pruebas/humo-entorno.ts [url]   (por defecto http://localhost:3001)
import { writeFileSync } from 'node:fs';
import { PIN_PRUEBA } from '../src/api/pruebas/entorno.ts';

const BASE = process.argv[2] ?? 'http://localhost:3001';
const API = `${BASE}/api/v1`;
const resultados: Array<{ caso: string; verificacion: string; esperado: string; obtenido: string; estado: 'Exitoso' | 'Fallido' }> = [];
const registrar = (caso: string, verificacion: string, esperado: string, obtenido: string, ok: boolean) =>
  resultados.push({ caso, verificacion, esperado, obtenido, estado: ok ? 'Exitoso' : 'Fallido' });

const entrar = (usuario: string, pin: string) =>
  fetch(`${API}/sesiones`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario, pin }) });
const cookieDe = (r: Response) => (r.headers.get('set-cookie') ?? '').split(';')[0];

// CP-037 · la aplicación web se sirve en el entorno
const raiz = await fetch(`${BASE}/`);
const html = await raiz.text();
registrar('CP-037', 'GET / sirve la PWA', '200 y HTML con el título del sistema', `${raiz.status}, título ${/<title>([^<]*)/.exec(html)?.[1] ?? '—'}`,
  raiz.status === 200 && html.includes('Hotel Golán'));

// CP-038 · PIN incorrecto (negativo). Un solo intento: el inicio correcto de CP-039 reinicia el contador.
const malo = await entrar('recepcion1', '000000');
const cuerpoMalo = await malo.json();
registrar('CP-038', 'PIN incorrecto', '401 CREDENCIALES_INVALIDAS sin cookie', `${malo.status} ${cuerpoMalo.codigo}, cookie: ${malo.headers.get('set-cookie') ? 'sí' : 'no'}`,
  malo.status === 401 && cuerpoMalo.codigo === 'CREDENCIALES_INVALIDAS' && !malo.headers.get('set-cookie'));

// CP-039 · cookie de sesión segura (NFR de seguridad, ADR-003)
const bueno = await entrar('recepcion1', PIN_PRUEBA);
const setCookie = bueno.headers.get('set-cookie') ?? '';
const banderas = ['HttpOnly', 'Secure', 'SameSite=Strict'].filter((b) => setCookie.toLowerCase().includes(b.toLowerCase()));
registrar('CP-039', 'Cookie de sesión', '201 con HttpOnly, Secure y SameSite=Strict', `${bueno.status}; banderas: ${banderas.join(', ')}; Max-Age: ${/Max-Age=(\d+)/i.exec(setCookie)?.[1] ?? '—'}`,
  bueno.status === 201 && banderas.length === 3);
const recepcion = cookieDe(bueno);

// CP-040 · control de acceso (negativos): sin sesión y con rol insuficiente
const sinSesion = await fetch(`${API}/habitaciones`);
const usuarios = await fetch(`${API}/usuarios`, { headers: { cookie: recepcion } });
const habitaciones = await fetch(`${API}/habitaciones`, { headers: { cookie: recepcion } });
const nHab = (await habitaciones.json()).items?.length;
registrar('CP-040', 'Acceso por rol', 'sin sesión 401; recepción en /usuarios 403; recepción ve 12 habitaciones',
  `sin sesión ${sinSesion.status}; /usuarios ${usuarios.status}; habitaciones ${habitaciones.status} (${nHab})`,
  sinSesion.status === 401 && usuarios.status === 403 && habitaciones.status === 200 && nHab === 12);

// CP-041 · rendimiento (NFR: p95 < 300 ms en APIs de consulta). 200 solicitudes secuenciales por API.
async function medir(nombre: string, hacer: () => Promise<Response>, n = 200) {
  const tiempos: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    const r = await hacer();
    await r.arrayBuffer();
    if (!r.ok) throw new Error(`${nombre}: ${r.status}`);
    tiempos.push(performance.now() - t0);
  }
  tiempos.sort((a, b) => a - b);
  const p = (q: number) => tiempos[Math.min(tiempos.length - 1, Math.ceil(q * tiempos.length) - 1)];
  return { nombre, n, p50: +p(0.5).toFixed(1), p95: +p(0.95).toFixed(1), max: +tiempos.at(-1)!.toFixed(1) };
}
const cotizacion = { habitacion_numero: '201', modalidad: 'NOCHE', personas: 2 };
const medidas = [
  await medir('GET /habitaciones', () => fetch(`${API}/habitaciones`, { headers: { cookie: recepcion } })),
  await medir('GET /turnos/actual', () => fetch(`${API}/turnos/actual`, { headers: { cookie: recepcion } })),
  await medir('POST /cotizaciones', () => fetch(`${API}/cotizaciones`, { method: 'POST', headers: { cookie: recepcion, 'content-type': 'application/json' }, body: JSON.stringify(cotizacion) })),
];
const peor = Math.max(...medidas.map((m) => m.p95));
registrar('CP-041', 'Rendimiento p95', 'p95 < 300 ms en cada API', medidas.map((m) => `${m.nombre}: p50 ${m.p50} ms, p95 ${m.p95} ms, máx ${m.max} ms`).join('; '), peor < 300);

await fetch(`${API}/sesiones/actual`, { method: 'DELETE', headers: { cookie: recepcion } });

const salida = { url: BASE, fecha: new Date().toISOString(), resultados, medidas };
writeFileSync('pruebas/evidencias/humo-entorno.json', JSON.stringify(salida, null, 2));
for (const r of resultados) console.log(`${r.estado.padEnd(8)} ${r.caso} ${r.verificacion}: ${r.obtenido}`);
process.exitCode = resultados.every((r) => r.estado === 'Exitoso') ? 0 : 1;
