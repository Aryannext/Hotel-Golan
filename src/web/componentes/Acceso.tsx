// Pantalla de inicio de sesión (FR-19): usuario + PIN de 6 dígitos. Mismo diseño que el prototipo.
import { useEffect, useState } from 'preact/hooks';
import { api, ErrorApi, type SesionActual } from '../api.ts';
import { Ico } from './Ico.tsx';

// Lo que el sistema hace de verdad. El BOCETO 02 lista «Reservas», que no existe.
const QUE_HACE = [
  { ico: 'habitaciones', texto: 'Habitaciones y entradas' },
  { ico: 'caja', texto: 'Caja por turno' },
  { ico: 'transferencia', texto: 'Transferencias al instante' },
  { ico: 'check', texto: 'Acceso con PIN' },
];

export function Acceso({ alEntrar, mensaje }: { alEntrar: (s: SesionActual) => void; mensaje?: string }) {
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verPin, setVerPin] = useState(false);
  // El aviso se quita solo: antes se quedaba en pantalla hasta volver a entrar.
  const [avisoVisible, setAvisoVisible] = useState(true);
  useEffect(() => {
    if (!mensaje) return;
    setAvisoVisible(true);
    const reloj = setTimeout(() => setAvisoVisible(false), 5000);
    return () => clearTimeout(reloj);
  }, [mensaje]);
  const propsPin = {
    id: 'pin', class: 'pin', placeholder: 'PIN de 6 dígitos', inputmode: 'numeric', maxLength: 6,
    autocomplete: 'current-password', value: pin,
    onInput: (e: Event) => setPin((e.target as HTMLInputElement).value.replace(/\D/g, '')),
  };

  async function enviar(ev: Event) {
    ev.preventDefault();
    if (!/^\d{6}$/.test(pin)) { setError('El PIN tiene 6 números.'); return; }
    setEnviando(true);
    setError('');
    try {
      alEntrar(await api.iniciarSesion(usuario.trim().toLowerCase(), pin));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo conectar con el sistema.');
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <dialog open class="acceso-pant" aria-modal="true" aria-labelledby="acceso-titulo">
      <div class="acceso__caja">
        {/* Panel de marca (BOCETO 02). En el boceto lleva una foto del hotel; aquí va
            el rojo de la marca hasta que haya una fotografía propia del Golán. */}
        <div class="acceso__marca">
          <svg class="acceso__logo" role="img" aria-label="Hotel Golán, lugar de refugio"><use href="#logo-golan" /></svg>
          <p class="acceso__lema">Todo tu hotel en un solo lugar</p>
          <p class="acceso__sub">Organiza, registra y controla con facilidad.</p>
          <ul class="acceso__lista">
            {QUE_HACE.map((q) => <li key={q.texto}><Ico id={q.ico} clase="ico--s" />{q.texto}</li>)}
          </ul>
        </div>
        <div class="acceso__columna">
          {/* El aviso va fuera de la tarjeta, sobre la foto, para no partir el formulario. */}
          {mensaje && avisoVisible && <p class="acceso__aviso" role="status"><Ico id="check" clase="ico--s" />{mensaje}</p>}
          <div class="acceso__tarjeta">
          <h1 id="acceso-titulo">Bienvenido</h1>
          <p class="ayuda">Inicie sesión para continuar con la gestión del hotel.</p>
          <form class="pila" style="gap:12px" onSubmit={enviar} noValidate>
            {/* El boceto no dibuja etiquetas: el nombre del campo va dentro. La etiqueta
                se mantiene en el marcado, oculta, para que los lectores de pantalla la lean. */}
            <div class="campo">
              <label htmlFor="usuario" class="oculto">Usuario</label>
              <div class="campo__conicono">
                <Ico id="usuario" clase="ico--s campo__icono" />
                <input id="usuario" placeholder="Usuario" autocomplete="username" autocapitalize="none" value={usuario}
                  onInput={(e) => setUsuario((e.target as HTMLInputElement).value)} required />
              </div>
            </div>
            <div class={`campo${error ? ' campo--error' : ''}`}>
              <label htmlFor="pin" class="oculto">PIN de 6 dígitos</label>
              <div class="campo__conicono campo__conojo">
                <Ico id="candado" clase="ico--s campo__icono" />
                {/* Dos ramas y no una variable: Preact exige que «type» sea un literal. */}
                {verPin
                  ? <input {...propsPin} type="text" aria-label="PIN de 6 dígitos" />
                  : <input {...propsPin} type="password" />}
                {/* Ver el PIN ayuda a no equivocarse tecleando en el celular. */}
                <button type="button" class="campo__ojo" aria-pressed={verPin}
                  aria-label={verPin ? 'Ocultar el PIN' : 'Mostrar el PIN'} onClick={() => setVerPin(!verPin)}>
                  <Ico id="ojo" clase="ico--s" />
                </button>
              </div>
              {error && <span class="campo__error" role="alert">{error}</span>}
            </div>
            <button type="submit" class="btn btn--primario btn--l btn--bloque" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Ingresar'} <Ico id="adelante" clase="ico--s" />
            </button>
          </form>
          {/* No hay recuperación por cuenta propia: los PIN los cambia la administración
              desde Equipo, así que se dice en vez de enlazar a algo que no existe. */}
          <p class="acceso__olvido"><b>¿Olvidó su PIN?</b>Pídale a la administración que le asigne uno nuevo.</p>
          <p class="acceso__pie"><Ico id="habitaciones" clase="ico--s" />La sesión dura 12 horas, lo que dura un turno.</p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
