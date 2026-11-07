// Panel lateral de detalles de la habitación (Imagen 1).
// Incluye foto de la habitación (con opción de subir/tomar foto), pestañas y datos detallados.
import { useEffect, useState } from 'preact/hooks';
import { api, type Estadia, type Habitacion } from '../api.ts';
import { claseEstado, horaBogota, pesos, textoEstado } from '../logica.ts';
import { fechaLarga, porQueNoSale, tarifaNoche, textoSaldo } from '../habitacion.ts';
import { FotoHabitacion } from './FotoHabitacion.tsx';
import { Ico } from './Ico.tsx';

type PestanaPanel = 'informacion' | 'huesped' | 'historial';

export function PanelHabitacion({
  habitacion,
  esAdmin = false,
  recarga = 0,
  alCerrar,
  alVerCuenta,
  alRegistrarSalida,
  alExtender,
  alCambiarEstado,
  alRegistrarEntrada,
}: {
  habitacion: Habitacion;
  esAdmin?: boolean;
  recarga?: number;
  alCerrar: () => void;
  alVerCuenta: () => void;
  alRegistrarSalida: () => void;
  alExtender: () => void;
  alCambiarEstado: () => void;
  alRegistrarEntrada?: () => void;
}) {
  const [est, setEst] = useState<Estadia | null>(null);
  const [pestana, setPestana] = useState<PestanaPanel>('informacion');
  const [nota, setNota] = useState('');
  const [notaGuardada, setNotaGuardada] = useState(false);
  useEffect(() => {
    try { setNota(localStorage.getItem(`golan-nota-demo-${habitacion.numero}`) ?? ''); } catch { setNota(''); }
    setNotaGuardada(false);
  }, [habitacion.numero]);
  const idEstadia = habitacion.estadia_activa?.id;

  useEffect(() => {
    if (!idEstadia) {
      setEst(null);
      return;
    }
    api.estadia(idEstadia).then(setEst).catch(() => setEst(null));
  }, [idEstadia, recarga]);

  const clase = claseEstado(habitacion.estado);
  const textoEst = textoEstado(habitacion.estado);
  const saldo = est && textoSaldo(est.cuenta);
  const impedimento = est && porQueNoSale(est.cuenta, pesos);
  const tarifa = est ? tarifaNoche(est.cargos) : null;

  return (
    <aside class="panel-lateral-hab" aria-label={`Detalles de Habitación ${habitacion.numero}`}>
      {/* Botón flotante para cerrar el panel */}
      <button
        type="button"
        class="panel-lateral-hab__btn-cerrar"
        aria-label="Cerrar los detalles"
        onClick={alCerrar}
      >
        <Ico id="cerrar" clase="ico--s" />
      </button>

      {/* Foto de la habitación con badge de estado flotante y opción de tomar/subir foto */}
      <div class="panel-lateral-hab__foto-wrapper">
        <FotoHabitacion
          numero={habitacion.numero}
          editable={esAdmin}
          altura={200}
          control="camara"
        />
      </div>

      {/* Título y categoría */}
      <div class="panel-lateral-hab__cab">
        <h2>Habitación {habitacion.numero} <span class={`pill pill--${clase}`}>{textoEst}</span></h2>
        <p class="panel-lateral-hab__tipo">
          Habitación estándar · {habitacion.tipo === 'AIRE' ? 'Aire acondicionado' : 'Ventilador'}
        </p>
      </div>

      {/* Pestañas (Información, Huésped, Historial) con indicador rojo activo */}
      <div class="panel-lateral-hab__pestanas" role="tablist">
        <button
          type="button"
          role="tab"
          class={`panel-hab-tab ${pestana === 'informacion' ? 'panel-hab-tab--activo' : ''}`}
          aria-selected={pestana === 'informacion'}
          onClick={() => setPestana('informacion')}
        >
          Información
        </button>
        <button
          type="button"
          role="tab"
          class={`panel-hab-tab ${pestana === 'huesped' ? 'panel-hab-tab--activo' : ''}`}
          aria-selected={pestana === 'huesped'}
          onClick={() => setPestana('huesped')}
        >
          Huésped
        </button>
        <button
          type="button"
          role="tab"
          class={`panel-hab-tab ${pestana === 'historial' ? 'panel-hab-tab--activo' : ''}`}
          aria-selected={pestana === 'historial'}
          onClick={() => setPestana('historial')}
        >
          Historial
        </button>
      </div>

      {/* Contenido según pestaña */}
      <div class="panel-lateral-hab__cuerpo">
        {!idEstadia ? (
          <div class="panel-lateral-hab__vacio">
            <Ico id="habitaciones" clase="ico--l" />
            <p>{habitacion.nota ?? 'La habitación no tiene una estadía activa en este momento.'}</p>
            <div class="panel-lateral-hab__vacio-pie">
              <button type="button" class="btn btn--primario btn--bloque" onClick={habitacion.estado === 'DISPONIBLE' ? alRegistrarEntrada : alCambiarEstado}>
                <Ico id={habitacion.estado === 'DISPONIBLE' ? 'nuevo-huesped' : 'escoba'} clase="ico--s" />
                {habitacion.estado === 'DISPONIBLE' ? 'Nueva entrada' : 'Cambiar estado'}
              </button>
            </div>
          </div>
        ) : !est ? (
          <p class="panel-lateral-hab__cargando">Cargando los datos de la estadía…</p>
        ) : pestana === 'informacion' ? (
          <div class="panel-lateral-hab__datos-lista">
            <h3 class="detalle-seccion-titulo">Información general</h3>
            <div class="panel-dato-fila"><span class="panel-dato-fila__etiqueta"><Ico id={habitacion.tipo === 'AIRE' ? 'aire' : 'ventilador'} clase="ico--xs" />Tipo</span><span class="panel-dato-fila__valor">{habitacion.tipo === 'AIRE' ? 'Aire acondicionado' : 'Ventilador'}</span></div>
            {/* Estado */}
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="calendario" clase="ico--xs" />
                <span>Estado</span>
              </span>
              <span class="panel-dato-fila__valor">
                <span class={`hab-filtro-dot hab-filtro-dot--${clase}`} />
                <strong class={`texto-estado--${clase}`}>{textoEst}</strong>
              </span>
            </div>

            {/* Huésped actual */}
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="huespedes" clase="ico--xs" />
                <span>Huésped actual</span>
              </span>
              <span class="panel-dato-fila__valor panel-dato-fila__valor--apilado">
                <strong>{est.huesped.nombre_mostrado}</strong>
                <span class="panel-dato-fila__subtexto">Teléfono no disponible</span>
              </span>
            </div>

            {/* Entrada */}
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="calendario" clase="ico--xs" />
                <span>Entrada</span>
              </span>
              <span class="panel-dato-fila__valor">
                {fechaLarga(est.entrada_en)} - {horaBogota(est.entrada_en)}
              </span>
            </div>

            {/* Salida */}
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="calendario" clase="ico--xs" />
                <span>Salida</span>
              </span>
              <span class="panel-dato-fila__valor">
                {fechaLarga(est.salida_prevista_en)} - {horaBogota(est.salida_prevista_en)}
              </span>
            </div>

            {/* Noches */}
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="reloj" clase="ico--xs" />
                <span>Noches</span>
              </span>
              <span class="panel-dato-fila__valor">
                <strong>{est.noches}</strong>
              </span>
            </div>

            {/* Tarifa */}
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="efectivo" clase="ico--xs" />
                <span>Tarifa</span>
              </span>
              <span class="panel-dato-fila__valor">
                <strong>{tarifa !== null ? `${pesos(tarifa)} / noche` : '—'}</strong>
              </span>
            </div>

            {/* Total estimado */}
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="tarjeta-pago" clase="ico--xs" />
                <span>Total estimado</span>
              </span>
              <span class="panel-dato-fila__valor">
                <strong>{pesos(est.cuenta.total_cargos)}</strong>
              </span>
            </div>

            {/* Saldo si aplica */}
            {saldo && (
              <div class={`panel-hab__saldo panel-hab__saldo--${saldo.tono}`} style="margin-top:8px">
                <span>{saldo.texto}</span>
                <strong>{pesos(est.cuenta.saldo > 0 ? est.cuenta.saldo : est.cuenta.a_favor)}</strong>
              </div>
            )}

            {/* Impedimento de salida */}
            {impedimento && (
              <p class="panel-hab__aviso">
                <Ico id="alerta" clase="ico--xs" />
                {impedimento}
              </p>
            )}
          </div>
        ) : pestana === 'huesped' ? (
          <div class="panel-lateral-hab__datos-lista">
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="usuario" clase="ico--xs" />
                <span>Nombre completo</span>
              </span>
              <span class="panel-dato-fila__valor">
                <strong>{est.huesped.nombre_mostrado}</strong>
              </span>
            </div>
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="nuevo-doc" clase="ico--xs" />
                <span>Documento</span>
              </span>
              <span class="panel-dato-fila__valor">
                {est.huesped.documento_enmascarado ?? 'No registrado'}
              </span>
            </div>
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="usuarios" clase="ico--xs" />
                <span>Personas</span>
              </span>
              <span class="panel-dato-fila__valor">{est.personas}</span>
            </div>
          </div>
        ) : (
          <div class="panel-lateral-hab__datos-lista">
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="reloj" clase="ico--xs" />
                <span>Registrada en</span>
              </span>
              <span class="panel-dato-fila__valor">
                {fechaLarga(est.registrada_en)} · {horaBogota(est.registrada_en)}
              </span>
            </div>
            <div class="panel-dato-fila">
              <span class="panel-dato-fila__etiqueta">
                <Ico id="usuario" clase="ico--xs" />
                <span>Registrada por</span>
              </span>
              <span class="panel-dato-fila__valor">{est.registrada_por}</span>
            </div>
          </div>
        )}
      </div>

      <section class="detalle-fotos"><h3 class="detalle-seccion-titulo">Fotos de la habitación</h3><FotoHabitacion numero={habitacion.numero} altura={76} control="agregar" editable={esAdmin} /></section>
      <section class="detalle-notas"><label class="detalle-seccion-titulo" htmlFor={`nota-${habitacion.numero}`}>Notas <span>Demo local</span></label>
        <textarea id={`nota-${habitacion.numero}`} maxLength={200} value={nota} placeholder="Escribe una nota sobre la habitación…" onInput={(ev) => { setNota((ev.target as HTMLTextAreaElement).value); setNotaGuardada(false); }} />
        <div class="detalle-notas__pie"><small>{nota.length}/200 · Solo este navegador</small><button type="button" class="enlace enlace--s" onClick={() => { try { localStorage.setItem(`golan-nota-demo-${habitacion.numero}`, nota); setNotaGuardada(true); } catch { setNotaGuardada(false); } }}>{notaGuardada ? 'Guardada' : 'Guardar nota'}</button></div>
      </section>

      {/* Se conservan los botones actuales y se añade la extensión existente. */}
      {idEstadia && est && (
        <div class="panel-lateral-hab__pie">
          <button type="button" class="panel-lateral-hab__btn-editar" onClick={alExtender}><Ico id="reloj" clase="ico--xs" />Extender estadía</button>
          <button
            type="button"
            class="panel-lateral-hab__btn-salida"
            onClick={alRegistrarSalida}
          >
            Registrar salida
          </button>
          <button
            type="button"
            class="panel-lateral-hab__btn-editar"
            onClick={alVerCuenta}
          >
            <Ico id="editar" clase="ico--xs" />
            <span>Ver cuenta</span>
          </button>
        </div>
      )}
    </aside>
  );
}
