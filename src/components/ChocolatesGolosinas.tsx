import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  Sparkles,
} from "lucide-react";
import { db } from "../firebase/config";

export type ChocolateProduct = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  category: string;
  stock: number;
  description: string;
};

type ChocolatesGolosinasProps = {
  onAddToCart?: (product: ChocolateProduct) => void;
  onViewProduct?: (product: ChocolateProduct) => void;
  quantityForProduct?: (id: string) => number;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);

export default function ChocolatesGolosinas({
  onAddToCart,
  onViewProduct,
  quantityForProduct,
}: ChocolatesGolosinasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<ChocolateProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        const catalog = snapshot.docs
          .map((item) => {
            const data = item.data();
            return {
              id: item.id,
              name: String(data.name ?? ""),
              price: Number(data.price ?? 0),
              originalPrice: Number(data.originalPrice ?? 0),
              image: String(data.image ?? ""),
              category: String(data.category ?? ""),
              stock: Number(data.stock ?? 0),
              description: String(data.description ?? ""),
              active: data.active !== false,
            };
          })
          .filter(
            (product) =>
              product.active &&
              product.stock > 0 &&
              /golosin|chocolate/i.test(product.category)
          )
          .map(
            ({
              id,
              name,
              price,
              originalPrice,
              image,
              category,
              stock,
              description,
            }) => ({
              id,
              name,
              price,
              originalPrice,
              image,
              category,
              stock,
              description,
            })
          );
        setProducts(catalog);
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error al cargar chocolates y golosinas:", snapshotError);
        setError("No pudimos cargar estos productos.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const scrollProducts = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="chocolates-golosinas"
      className="relative overflow-hidden py-9 sm:py-12"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-7">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#10489f]">
              <Sparkles size={13} />
              PARA DARTE UN GUSTO
            </div>
            <h2 className="text-xl font-black tracking-tight text-[#142C4E] sm:text-3xl">
              Chocolates y golosinas
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Tus favoritos, siempre cerca.
            </p>
          </div>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : loading ? (
          <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
        ) : products.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#10489f]">
              <ImageIcon size={22} />
            </span>
            <h3 className="mt-3 text-sm font-bold text-[#142C4E]">
              Todavía no hay productos en esta categoría
            </h3>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              Cuando agregues chocolates o golosinas desde el panel, van a
              aparecer acá automáticamente.
            </p>
          </div>
        ) : (
          <div className="group relative">
            <button
              type="button"
              onClick={() => scrollProducts("left")}
              aria-label="Ver productos anteriores"
              className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[#142C4E] shadow-md transition hover:bg-[#142C4E] hover:text-white md:flex"
            >
              <ChevronLeft size={21} />
            </button>

            <div
              ref={scrollRef}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-4 sm:gap-5"
              style={{ scrollbarWidth: "none" }}
            >
              {products.map((product) => {
                const hasDiscount = product.originalPrice > product.price;
                const discount = hasDiscount
                  ? Math.round((1 - product.price / product.originalPrice) * 100)
                  : 0;
                const quantity = quantityForProduct?.(product.id) ?? 0;

                return (
                  <article
                    key={product.id}
                    className="group/card relative flex w-[155px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-[205px] sm:rounded-3xl"
                  >
                    <button
                      type="button"
                      onClick={() => onViewProduct?.(product)}
                      className="relative flex h-[145px] w-full items-center justify-center overflow-hidden bg-white p-3 sm:h-[195px] sm:p-5"
                      aria-label={`Ver ${product.name}`}
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                          className="h-full w-full object-contain transition-transform duration-500 group-hover/card:scale-105"
                        />
                      ) : (
                        <ImageIcon className="text-slate-300" size={40} />
                      )}
                      {hasDiscount && (
                        <span className="absolute left-2 top-2 rounded-full bg-[#10489f] px-2 py-1 text-[9px] font-extrabold text-white sm:left-3 sm:top-3 sm:text-[10px]">
                          -{discount}%
                        </span>
                      )}
                    </button>

                    <div className="flex flex-1 flex-col p-3 sm:p-4">
                      <span className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:text-[11px]">
                        {product.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => onViewProduct?.(product)}
                        className="min-h-[36px] text-left text-xs font-bold leading-snug text-[#142C4E] sm:min-h-[42px] sm:text-sm"
                      >
                        {product.name}
                      </button>
                      {hasDiscount && (
                        <p className="mt-3 text-[10px] text-slate-400 line-through sm:text-xs">
                          {formatPrice(product.originalPrice)}
                        </p>
                      )}
                      <p className="text-lg font-black tracking-tight text-[#142C4E] sm:text-xl">
                        {formatPrice(product.price)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onAddToCart?.(product)}
                        disabled={!onAddToCart || quantity >= product.stock}
                        className="mt-3 flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-[#142C4E] px-2 py-2 text-[11px] font-bold text-white transition hover:bg-[#10489f] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:gap-2 sm:text-xs"
                      >
                        <Plus size={15} strokeWidth={2.5} />
                        {quantity >= product.stock
                          ? "Sin stock disponible"
                          : quantity
                            ? `${quantity} en el carrito · Agregar`
                            : "Agregar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollProducts("right")}
              aria-label="Ver más productos"
              className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[#142C4E] shadow-md transition hover:bg-[#142C4E] hover:text-white md:flex"
            >
              <ChevronRight size={21} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
