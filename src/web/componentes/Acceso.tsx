// Pantalla de inicio de sesión (FR-19): usuario + PIN de 6 dígitos. Mismo diseño que el prototipo.
import { useState } from 'preact/hooks';
import { api, ErrorApi, type SesionActual } from '../api.ts';
import { Ico } from './Ico.tsx';

export function Acceso({ alEntrar, mensaje }: { alEntrar: (s: SesionActual) => void; mensaje?: string }) {
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

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
    <div class="acceso-pant" role="dialog" aria-modal="true" aria-labelledby="acceso-titulo">
      <div class="acceso__caja">
        <div class="acceso__marca">
          <svg class="acceso__logo" role="img" aria-label="Hotel Golán, lugar de refugio"><use href="#logo-golan" /></svg>
          <p>Sistema de recepción</p>
        </div>
        <div class="acceso__tarjeta">
          <h1 id="acceso-titulo">Iniciar sesión</h1>
          {mensaje && <div class="nota nota--info"><Ico id="check" clase="ico--s" /><p>{mensaje}</p></div>}
          <form class="pila" style="gap:12px" onSubmit={enviar} noValidate>
            <div class="campo">
              <label for="usuario">Usuario</label>
              <input id="usuario" autocomplete="username" autocapitalize="none" value={usuario}
                onInput={(e) => setUsuario((e.target as HTMLInputElement).value)} required />
            </div>
            <div class={`campo${error ? ' campo--error' : ''}`}>
              <label for="pin">PIN de 6 dígitos</label>
              <input id="pin" class="pin" type="password" inputmode="numeric" maxLength={6} autocomplete="current-password"
                value={pin} onInput={(e) => setPin((e.target as HTMLInputElement).value.replace(/\D/g, ''))} />
              {error && <span class="campo__error" role="alert">{error}</span>}
            </div>
            <button type="submit" class="btn btn--primario btn--l btn--bloque" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'} <Ico id="adelante" clase="ico--s" />
            </button>
          </form>
        </div>
        <p class="acceso__pie">Acceso solo para el personal del Hotel Golán.</p>
      </div>
    </div>
  );
}
