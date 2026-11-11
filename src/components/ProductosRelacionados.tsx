
import { ArrowRight, Plus, Truck, Zap } from "lucide-react";

export interface ProductoRelacionadoData {
  id: string;
  nombre: string;
  precio: number;
  precioAnterior?: number;
  imagen: string;
  categoria?: string;
  marca?: string;
  descripcion?: string;
}

interface ProductosRelacionadosProps {
  productos: ProductoRelacionadoData[];
  productoActual: ProductoRelacionadoData;
  onVerProducto: (producto: ProductoRelacionadoData) => void;
  onAgregarAlCarrito?: (producto: ProductoRelacionadoData) => void;
}

export default function ProductosRelacionados({
  productos,
  productoActual,
  onVerProducto,
  onAgregarAlCarrito,
}: ProductosRelacionadosProps) {
  const relacionados = productos
    .filter((producto) => producto.id !== productoActual.id)
    .slice(0, 15);

  if (relacionados.length === 0) return null;

  const formatoPrecio = (precio: number) =>
    precio.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    });

  return (
    <section className="w-full  py-8 sm:py-10">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mb-5 flex items-end justify-between gap-3 sm:mb-6">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              También te puede interesar
            </p>

            <h3 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Productos relacionados
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Encontrá algo más para sumar a tu compra.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-slate-500 sm:flex">
            Deslizá para ver más
            <ArrowRight size={16} />
          </div>
        </div>

        {/* Carrusel sin barra horizontal visible */}
        <div
          className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 pt-1"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {relacionados.map((producto) => {
            const tieneDescuento =
              typeof producto.precioAnterior === "number" &&
              producto.precioAnterior > producto.precio;

            const descuento = tieneDescuento
              ? Math.round(
                  (1 - producto.precio / producto.precioAnterior!) * 100
                )
              : 0;

            return (
              <article
                key={producto.id}
                className="group relative flex w-[190px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60 sm:w-[220px]"
              >
                {/* Imagen del producto */}
                <button
                  type="button"
                  onClick={() => onVerProducto(producto)}
                  className="relative block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`Ver ${producto.nombre}`}
                >
                  <div className="relative flex h-[180px] items-center justify-center overflow-hidden bg-white p-4 sm:h-[205px] sm:p-5">
                    {tieneDescuento && (
                      <span className="absolute left-3 top-3 z-10 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white shadow-sm">
                        -{descuento}%
                      </span>
                    )}

                    <img
                      src={producto.imagen}
                      alt={producto.nombre}
                      loading="lazy"
                      className="relative z-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                </button>

                {/* Información */}
                <div className="flex flex-1 flex-col px-3.5 pb-3 pt-3 sm:px-4">
                  <div className="mb-2 flex min-h-[18px] items-center gap-1.5">
                    {producto.marca && (
                      <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {producto.marca}
                      </span>
                    )}

                    {producto.marca && producto.categoria && (
                      <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                    )}

                    {producto.categoria && (
                      <span className="truncate text-[10px] font-medium text-slate-400">
                        {producto.categoria}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onVerProducto(producto)}
                    className="mb-3 min-h-[40px] cursor-pointer text-left text-sm font-semibold leading-snug text-slate-800 transition-colors hover:text-blue-600"
                  >
                    {producto.nombre}
                  </button>

                  {/* Precios */}
                  <div className="mt-auto">
                    {tieneDescuento && (
                      <p className="text-xs text-slate-400 line-through">
                        {formatoPrecio(producto.precioAnterior!)}
                      </p>
                    )}

                    <p className="text-xl font-extrabold tracking-tight text-slate-950">
                      {formatoPrecio(producto.precio)}
                    </p>
                  </div>

                  {/* Retiro en local */}
                  <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
                    <Truck size={14} className="shrink-0 text-emerald-600" />

                    <span className="text-[11px] font-medium text-slate-500">
                      Retiro en local
                    </span>

                    <Zap
                      size={13}
                      className="ml-auto shrink-0 fill-amber-400 text-amber-400"
                    />
                  </div>

                  {/* Agregar al carrito */}
                  <button
                    type="button"
                    onClick={() => onAgregarAlCarrito?.(producto)}
                    className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    <Plus size={15} strokeWidth={2.5} />
                    Agregar al carrito
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Indicador inferior discreto en móvil */}
        <div className="mt-3 flex items-center justify-center gap-1.5 sm:hidden">
          <span className="h-1 w-8 rounded-full bg-blue-600" />
          <span className="h-1 w-3 rounded-full bg-slate-200" />
          <span className="h-1 w-3 rounded-full bg-slate-200" />
          <span className="ml-1 text-[10px] font-medium text-slate-400">
            Deslizá para explorar
          </span>
        </div>
      </div>

      {/* Oculta el scrollbar sin desactivar el desplazamiento */}
      <style>{`
        .productos-relacionados-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
