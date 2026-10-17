// Catálogo para elegir productos con cantidad (ficha de la habitación y venta de contado, TICKET-22).
import { Fragment } from 'preact';
import { agruparCatalogo, pesos, type Producto, type resumenSeleccion } from '../logica.ts';

type Seleccion = ReturnType<typeof resumenSeleccion>;

/** «Agregar Agua» o, si ya eligió, «Agregar Agua, van 2». */
const etiquetaProducto = (nombre: string, n: number) => (n ? `Agregar ${nombre}, van ${n}` : `Agregar ${nombre}`);

export function SelectorProductos({ catalogo, cantidades, sel, sumar }: {
  catalogo: Producto[]; cantidades: Record<string, number>; sel: Seleccion; sumar: (pid: string, paso: number) => void;
}) {
  return <>
    {agruparCatalogo(catalogo).map(([grupo, productos]) => <Fragment key={grupo}>
      <p class="subtitulo">{grupo}</p>
      <div class="catalogo">{productos.map((p) => {
        const n = cantidades[p.id] ?? 0;
        return <button key={p.id} type="button" class="producto" aria-pressed={n > 0} aria-label={etiquetaProducto(p.nombre, n)} onClick={() => sumar(p.id, 1)}>
          <strong>{p.nombre}</strong><span>{pesos(p.precio)}</span>{n > 0 && <em class="producto__n">{n}</em>}</button>;
      })}</div>
    </Fragment>)}
    {sel.items.length === 0
      ? <p class="ayuda">Toque los productos para agregarlos. Puede elegir varios y tocar de nuevo para sumar cantidad.</p>
      : <section class="tarjeta tarjeta--oro"><div class="tarjeta__cab"><h3>Seleccionados</h3></div>
        {sel.items.map((x) => <div key={x.producto.id} class="item-sel"><span class="item-sel__nombre">{x.producto.nombre}</span>
          <div class="contador contador--mini">
            <button type="button" aria-label={`Quitar uno de ${x.producto.nombre}`} onClick={() => sumar(x.producto.id, -1)}>−</button>
            <output>{x.cantidad}</output>
            <button type="button" aria-label={`Agregar uno de ${x.producto.nombre}`} onClick={() => sumar(x.producto.id, 1)}>+</button>
          </div><strong>{pesos(x.subtotal)}</strong></div>)}
        <div class="fila fila--total"><div class="fila__txt"><div class="fila__concepto">Total</div></div><div class="fila__valor">{pesos(sel.total)}</div></div>
      </section>}
  </>;
}

