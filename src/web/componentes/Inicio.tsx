// Pantalla de Inicio (BOCETO 03): el resumen del hotel al empezar el turno.
// Implementación fiel al diseño con métricas en tiempo real, widgets analíticos
// para administración y acciones operativas inmediatas.
import { useEffect, useState } from 'preact/hooks';
import { api, type Habitacion, type Pago, type ResumenDia, type TitularHoy } from '../api.ts';
import { claseEstado, filtrarPorGrupo, hoyBogota, textoEstado, type FiltroMapa, type GrupoEstado } from '../logica.ts';
import {
  ocupacion,
  dineroDelDia,
  calcularFlujoDia,
  calcularDesgloseMedios,
  obtenerActividadReciente,
  serieIngresos,
  trazoIngresos,
  type DineroDelDia,
} from '../inicio.ts';
import { Ico } from './Ico.tsx';
import { GraficoOcupacion } from './GraficoOcupacion.tsx';
import { TarjetaIngresos } from './TarjetaIngresos.tsx';
import { TarjetaPagos } from './TarjetaPagos.tsx';
import { TarjetaActividad } from './TarjetaActividad.tsx';

// Filtros para la vista resumida de habitaciones del inicio
const GRUPOS: Array<{ grupo: GrupoEstado; clase: string; texto: string }> = [
  { grupo: 'ocupadas', clase: 'ocupada', texto: 'Ocupadas' },
  { grupo: 'disponibles', clase: 'libre', texto: 'Libres' },
  { grupo: 'limpiezaORevision', clase: 'limpieza', texto: 'Limpieza' },
];

export function Inicio({
  habitaciones,
  porConfirmar,
  esAdmin,
  recarga = 0,
  alIrA,
  alAbrirHabitacion,
}: {
  habitaciones: Habitacion[];
  porConfirmar: Pago[];
  esAdmin: boolean;
  recarga?: number;
  alIrA: (vista: 'mapa' | 'confirmar' | 'caja') => void;
  alAbrirHabitacion?: (h: Habitacion) => void;
}) {
  const [dinero, setDinero] = useState<DineroDelDia | null>(null);
  const [dias, setDias] = useState<ResumenDia[]>([]);
  const [pagosRecientes, setPagosRecientes] = useState<Pago[]>([]);
  const [estadiasHoy, setEstadiasHoy] = useState<TitularHoy[]>([]);
  const [filtro, setFiltro] = useState<FiltroMapa>('todas');

  const hoy = hoyBogota();
  const o = ocupacion(habitaciones);
  // Las entradas del día salen de las estadías activas, que traen la hora real de
  // entrada; el mapa de habitaciones no la tiene.
  const flujo = calcularFlujoDia(estadiasHoy, hoy);

  // Quiénes están hoy: lo consultan recepción y la administración.
  useEffect(() => {
    api.huespedesHoy()
      .then((r) => setEstadiasHoy(r.items))
      .catch(() => setEstadiasHoy([]));
  }, [recarga]);

  // Carga de reporte diario y pagos para administración
  useEffect(() => {
    if (!esAdmin) {
      setDinero(null);
      setDias([]);
      setPagosRecientes([]);
      return;
    }

    // Una semana, para que el gráfico de ingresos tenga días de verdad que mostrar.
    const desde = new Date(`${hoy}T12:00:00Z`);
    desde.setUTCDate(desde.getUTCDate() - 6);

    api.reporteDias(desde.toISOString().slice(0, 10), hoy)
      .then((r) => { setDias(r.items); setDinero(dineroDelDia(r.items, hoy)); })
      .catch(() => { setDias([]); setDinero(null); });

    // Consultar turnos recientes para obtener pagos reales del día
    api.turnos(0, 1)
      .then((res) => {
        const turnoActual = res.items[0];
        if (turnoActual) {
          return api.pagosDelTurno(turnoActual.id);
        }
        return { items: [] };
      })
      .then((res) => setPagosRecientes(res.items))
      .catch(() => setPagosRecientes([]));
  }, [esAdmin, recarga, hoy]);

  // Cálculos puros para los widgets analíticos
  const medios = calcularDesgloseMedios(dinero, pagosRecientes);
  // Sin movimientos la lista va vacía: la tarjeta ya dice «Sin movimientos
  // registrados en este turno», que es la verdad.
  const actividad = obtenerActividadReciente(pagosRecientes);
  const trazo = trazoIngresos(serieIngresos(dias, hoy));

  // Sin informe del día todavía, el día va en $0: no hay con qué comparar y el
  // porcentaje de variación se omite en vez de suponerlo.
  const ingresosFinal = dinero ? dinero.ingresos : 0;
  const variacionFinal = dinero ? dinero.variacion : null;

  return (
    <div class="inicio-dashboard">
      {/* Sección Superior: Título, KPIs y Acciones rápidas (BOCETO 03) */}
      <div class="inicio__columnas">
        {/* Cabecera del Inicio con ícono de casa */}
        <header class="inicio__titulo">
          <span class="inicio__ico-casa" aria-hidden="true">
            <Ico id="inicio" clase="ico--l" />
          </span>
          <div>
            <h1>Bienvenido</h1>
            <p>{esAdmin ? 'Sistema Administrativo • Hotel Golán' : 'Sistema de recepción • Hotel Golán'}</p>
          </div>
        </header>

        {/* 4 Indicadores superiores (KPIs) */}
        <div class="stats inicio__stats">
          <div class="stat stat--kpi stat--ocupada">
            <span class="stat__ico"><Ico id="habitaciones" clase="ico--l" /></span>
            <span>
              <strong>{o.ocupadas}</strong>
              <span>Habitaciones ocupadas</span>
            </span>
          </div>

          <div class="stat stat--kpi stat--libre">
            <span class="stat__ico"><Ico id="habitaciones" clase="ico--l" /></span>
            <span>
              <strong>{o.disponibles}</strong>
              <span>Habitaciones libres</span>
            </span>
          </div>

          <div class="stat stat--kpi stat--entrada">
            <span class="stat__ico"><Ico id="diagonal" clase="ico--l" /></span>
            <span>
              <strong>{flujo.entradasHoy}</strong>
              <span>Entradas de hoy</span>
            </span>
          </div>

          <div class="stat stat--kpi stat--salida">
            <span class="stat__ico"><Ico id="adelante" clase="ico--l" /></span>
            <span>
              <strong>{flujo.salidasPrevistasHoy}</strong>
              <span>Salidas previstas hoy</span>
            </span>
          </div>
        </div>

        {/* Columna lateral derecha: Acciones rápidas */}
        <aside class="inicio__lateral">
          <section class="tarjeta tarjeta--acciones">
            <div class="tarjeta__cab">
              <h2>Acciones rápidas</h2>
            </div>
            <div class="inicio__acciones">
              <div class="accion">
                <span class="accion__ico accion__ico--marca">
                  <Ico id="usuario" clase="ico--l" />
                </span>
                <h3>Registrar entrada</h3>
                <p>Selecciona una habitación para registrar una nueva entrada.</p>
                <button type="button" class="btn btn--primario btn--bloque" onClick={() => alIrA('mapa')}>
                  Nueva entrada <Ico id="adelante" clase="ico--s" />
                </button>
              </div>

              {esAdmin && (
                <div class="accion">
                  <span class="accion__ico accion__ico--oscuro">
                    <Ico id="banco" clase="ico--l" />
                  </span>
                  <h3>Confirmar transferencia</h3>
                  <p>Revisa y confirma los pagos por Nequi o Bancolombia.</p>
                  <button type="button" class="btn btn--crema btn--bloque" onClick={() => alIrA('confirmar')}>
                    Ver transferencias
                    {porConfirmar.length > 0 && <span class="pestana__cuenta">{porConfirmar.length}</span>}{' '}
                    <Ico id="adelante" clase="ico--s" />
                  </button>
                </div>
              )}
            </div>
          </section>
        </aside>

        {/* Área Central: Estado de habitaciones y mini-mapa */}
        <div class="inicio__principal">
          <section class="tarjeta inicio__cuartos">
            <div class="tarjeta__cab tarjeta__cab--entre">
              <h2>Estado de habitaciones</h2>
              <div class="filtros__grupo" role="group" aria-label="Filtrar por estado">
                <button
                  type="button"
                  class={`filtro ${filtro === 'todas' ? 'filtro--activo-marca' : ''}`}
                  aria-pressed={filtro === 'todas'}
                  onClick={() => setFiltro('todas')}
                >
                  Todos <span class="filtro__cuenta">{habitaciones.length}</span>
                </button>
                {GRUPOS.map((g) => (
                  <button
                    key={g.grupo}
                    type="button"
                    class={`filtro filtro--${g.clase} ${filtro === g.grupo ? 'filtro--activo' : ''}`}
                    aria-pressed={filtro === g.grupo}
                    onClick={() => setFiltro(filtro === g.grupo ? 'todas' : g.grupo)}
                  >
                    {g.texto} <span class="filtro__cuenta">{o[g.grupo]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div class="mini-mapa">
              {filtrarPorGrupo(habitaciones, filtro).map((h) => (
                <button
                  key={h.numero}
                  type="button"
                  class={`mini-cuarto mini-cuarto--${claseEstado(h.estado)}`}
                  onClick={() => alAbrirHabitacion ? alAbrirHabitacion(h) : alIrA('mapa')}
                  aria-label={`Habitación ${h.numero}, ${textoEstado(h.estado)}`}
                >
                  <span class="mini-cuarto__fila">
                    <Ico id="habitaciones" clase="ico--s" />
                    <strong>{h.numero}</strong>
                  </span>
                  <span class={`pill pill--${claseEstado(h.estado)}`}>{textoEstado(h.estado)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Fila Inferior: Widgets Analíticos para el perfil de Administración (BOCETO 03) */}
      {esAdmin && (
        <div class="inicio__inferior">
          <GraficoOcupacion
            ocupadas={o.ocupadas}
            libres={o.disponibles}
            limpieza={o.limpiezaORevision}
            total={o.total}
            porcentaje={o.porcentaje}
          />
          <TarjetaIngresos
            ingresos={ingresosFinal}
            variacion={variacionFinal}
            trazo={trazo}
          />
          <TarjetaPagos
            efectivo={medios.efectivo}
            nequi={medios.nequi}
            bancolombia={medios.bancolombia}
            transferencias={medios.transferencias}
            detallado={medios.detallado}
          />
          <TarjetaActividad
            eventos={actividad}
            alVerTodas={() => alIrA('caja')}
          />
        </div>
      )}
    </div>
  );
}
