
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Image as ImageIcon,
} from "lucide-react";
import ProductosRelacionados from "../components/ProductosRelacionados";
import type { ProductoRelacionadoData } from "../components/ProductosRelacionados";

export interface ProductoDetalleData {
  id: string;
  nombre: string;
  precio: number;
  precioAnterior?: number;
  imagen: string;
  imagenes?: string[];
  categoria?: string;
  marca?: string;
  stock?: number;
  descripcion?: string;
  caracteristicas?: { nombre: string; valor: string }[];
}

interface ProductoDetalleProps {
  producto: ProductoDetalleData;
  onVolver: () => void;
  onAgregarAlCarrito: (
    producto: ProductoDetalleData,
    cantidad: number
  ) => void;
  productosRelacionados?: ProductoRelacionadoData[];
  onVerProductoRelacionado?: (
    producto: ProductoRelacionadoData
  ) => void;
}

const formatoPrecio = (precio: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(precio);

export default function ProductoDetalle({
  producto,
  onVolver,
  onAgregarAlCarrito,
  productosRelacionados = [],
  onVerProductoRelacionado = () => {},
}: ProductoDetalleProps) {
  const imagenes =
    producto.imagenes?.length
      ? producto.imagenes
      : producto.imagen
        ? [producto.imagen]
        : [];

  const [imagenActiva, setImagenActiva] = useState(
    imagenes[0] ?? ""
  );
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    setImagenActiva(imagenes[0] ?? "");
    setCantidad(1);
  }, [producto.id, producto.imagen, producto.imagenes]);

  const hayStock = producto.stock === undefined || producto.stock > 0;

  const descuento =
    producto.precioAnterior && producto.precioAnterior > producto.precio
      ? Math.round(
          ((producto.precioAnterior - producto.precio) /
            producto.precioAnterior) *
            100
        )
      : 0;

  const cambiarCantidad = (valor: number) => {
    const maximo = producto.stock ?? Number.MAX_SAFE_INTEGER;

    setCantidad(Math.max(1, Math.min(valor, maximo)));
  };

  return (
    <main className="min-h-screen bg-[#f5f8fc] pb-16 text-[#142c4e]">
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10">
        {/* Navegación */}
        <button
          type="button"
          onClick={onVolver}
          className="mb-6 inline-flex items-center gap-2 rounded-xl py-2 text-sm font-semibold text-slate-500 transition hover:text-[#10489f]"
        >
          <ArrowLeft size={18} />
          Volver al mercado
        </button>


        {/* Producto */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          {/* Galería */}
          <section className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row">
              {/* Miniaturas */}
              {imagenes.length > 1 && (
                <div className="order-2 flex gap-2 overflow-x-auto pb-1 sm:order-1 sm:max-h-[560px] sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden sm:pb-0">
                  {imagenes.map((imagen, indice) => (
                    <button
                      key={`${imagen}-${indice}`}
                      type="button"
                      aria-label={`Ver imagen ${indice + 1}`}
                      aria-pressed={imagenActiva === imagen}
                      onMouseEnter={() => setImagenActiva(imagen)}
                      onClick={() => setImagenActiva(imagen)}
                      className={`h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 transition sm:h-[84px] sm:w-[84px] ${
                        imagenActiva === imagen
                          ? "border-[#10489f] shadow-md"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <img
                        src={imagen}
                        alt={`${producto.nombre} - imagen ${indice + 1}`}
                        className="h-full w-full rounded-lg object-contain"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Imagen principal */}
              <div className="group relative order-1 flex aspect-square min-w-0 flex-1 items-center justify-center overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 sm:order-2 sm:p-10">
                {descuento > 0 && (
                  <span className="absolute left-4 top-4 z-10 rounded-full bg-[#10489f] px-3 py-1.5 text-xs font-extrabold text-white shadow-sm">
                    -{descuento}% OFF
                  </span>
                )}

                {imagenActiva ? (
                  <img
                    key={imagenActiva}
                    src={imagenActiva}
                    alt={producto.nombre}
                    className="h-full w-full object-contain transition-transform duration-500 "
                  />
                ) : (
                  <ImageIcon size={64} className="text-slate-300" />
                )}

                <span className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-slate-500 shadow-sm">
                  {imagenes.length}{" "}
                  {imagenes.length === 1 ? "imagen" : "imágenes"}
                </span>
              </div>
            </div>
          </section>

          {/* Información comercial */}
          <section className="min-w-0 lg:sticky lg:top-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {producto.categoria && (
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#10489f]">
                  {producto.categoria}
                </span>
              )}

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  hayStock
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hayStock ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                {hayStock
                  ? producto.stock !== undefined
                    ? `${producto.stock} disponibles`
                    : "Disponible"
                  : "Sin stock"}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-[#142c4e] sm:text-3xl lg:text-4xl">
              {producto.nombre}
            </h1>

            {producto.marca && (
              <p className="mt-3 text-sm text-slate-500">
                Marca:{" "}
                <span className="font-semibold text-slate-700">
                  {producto.marca}
                </span>
              </p>
            )}

            <div className="my-6 border-t border-slate-200" />

            <div>
              {descuento > 0 && (
                <div className="mb-1 flex flex-wrap items-center gap-3">
                  <span className="text-base text-slate-400 line-through">
                    {formatoPrecio(producto.precioAnterior!)}
                  </span>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                    Ahorrás{" "}
                    {formatoPrecio(
                      producto.precioAnterior! - producto.precio
                    )}
                  </span>
                </div>
              )}

              <p className="text-3xl font-extrabold tracking-tight text-[#142c4e] sm:text-4xl">
                {formatoPrecio(producto.precio)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Precio por unidad
              </p>
            </div>

            {/* Compra */}
            <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <p className="mb-3 text-sm font-bold">Cantidad</p>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 items-center rounded-xl border border-slate-200">
                  <button
                    type="button"
                    aria-label="Restar cantidad"
                    onClick={() => cambiarCantidad(cantidad - 1)}
                    disabled={cantidad <= 1}
                    className="flex h-full w-11 items-center justify-center text-slate-600 transition hover:text-[#10489f] disabled:opacity-30"
                  >
                    <Minus size={16} />
                  </button>

                  <span className="min-w-9 text-center font-bold tabular-nums">
                    {cantidad}
                  </span>

                  <button
                    type="button"
                    aria-label="Sumar cantidad"
                    onClick={() => cambiarCantidad(cantidad + 1)}
                    disabled={
                      producto.stock !== undefined &&
                      cantidad >= producto.stock
                    }
                    className="flex h-full w-11 items-center justify-center text-slate-600 transition hover:text-[#10489f] disabled:opacity-30"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <span className="text-sm text-slate-500">
                  Total:{" "}
                  <strong className="text-[#142c4e]">
                    {formatoPrecio(producto.precio * cantidad)}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                disabled={!hayStock}
                onClick={() => onAgregarAlCarrito(producto, cantidad)}
                className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#10489f] px-5 font-bold text-white shadow-lg shadow-blue-900/10 transition hover:bg-[#142c4e] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <ShoppingCart size={20} />
                {hayStock ? "Agregar al carrito" : "Producto sin stock"}
              </button>

              <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-blue-50 p-2 text-[#10489f]">
                    <Truck size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Entrega</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Consultá las opciones disponibles.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-blue-50 p-2 text-[#10489f]">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Compra segura</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Consultá los medios de pago.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Descripción y características */}
        <section className="mt-12 grid grid-cols-1 gap-6 lg:mt-16 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#10489f]">
              Conocé el producto
            </p>
            <h2 className="text-2xl font-extrabold text-[#142c4e]">
              Descripción
            </h2>

            <p className="mt-5 whitespace-pre-line text-sm leading-8 text-slate-600 sm:text-base">
              {producto.descripcion ||
                "Todavía no se agregó una descripción para este producto."}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#10489f]">
              Ficha técnica
            </p>
            <h2 className="text-2xl font-extrabold text-[#142c4e]">
              Características
            </h2>

            {producto.caracteristicas?.length ? (
              <div className="mt-5 divide-y divide-slate-100">
                {producto.caracteristicas.map((caracteristica, index) => (
                  <div
                    key={`${caracteristica.nombre}-${index}`}
                    className="flex items-start gap-3 py-3"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#10489f]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">
                        {caracteristica.nombre}
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold text-[#142c4e]">
                        {caracteristica.valor}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-7 text-slate-500">
                Las características técnicas todavía no están disponibles.
              </p>
            )}
          </div>
        </section>

        {/* Productos relacionados */}
        <ProductosRelacionados
          productos={productosRelacionados}
          productoActual={producto}
          onVerProducto={onVerProductoRelacionado}
        />

        <button
          type="button"
          onClick={onVolver}
          className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#10489f] transition hover:gap-3"
        >
          <ArrowLeft size={17} />
          Seguir comprando
          <ChevronRight size={15} />
        </button>
      </div>
    </main>
  );
}
