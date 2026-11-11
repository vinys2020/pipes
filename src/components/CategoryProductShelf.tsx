import { useRef } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  PackageOpen,
  Plus,
} from "lucide-react";
import { getProductsForCategory } from "../lib/storefront";

export type CategoryProduct = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  category: string;
  description: string;
  stock: number;
};

export type CategoryShelfProps = {
  products: CategoryProduct[];
  loading: boolean;
  onAddToCart: (product: CategoryProduct) => void;
  onViewProduct: (product: CategoryProduct) => void;
  quantityForProduct: (id: string) => number;
  onSeeCategory: (category: string) => void;
};

type CategoryProductShelfProps = CategoryShelfProps & {
  category: string;
  eyebrow: string;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);

function categoryId(category: string) {
  return `categoria-${category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export default function CategoryProductShelf({
  category,
  eyebrow,
  products,
  loading,
  onAddToCart,
  onViewProduct,
  quantityForProduct,
  onSeeCategory,
}: CategoryProductShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const categoryProducts = getProductsForCategory(products, category);
  const id = categoryId(category);

  const scrollProducts = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-28 border-b border-slate-100 py-9 sm:py-12"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-7">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#10489f]">
              <PackageOpen size={13} />
              {eyebrow}
            </div>
            <h2
              id={`${id}-title`}
              className="text-xl font-black tracking-tight text-[#142C4E] sm:text-3xl"
            >
              {category}
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              {loading
                ? "Cargando productos…"
                : `${categoryProducts.length} ${
                    categoryProducts.length === 1 ? "producto disponible" : "productos disponibles"
                  }`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-hidden sm:gap-5">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-64 w-[155px] shrink-0 animate-pulse rounded-2xl bg-slate-200 sm:h-80 sm:w-[205px] sm:rounded-3xl"
              />
            ))}
          </div>
        ) : categoryProducts.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF2FF] text-[#10489f]">
              <PackageOpen size={23} />
            </span>
            <h3 className="mt-3 text-sm font-bold text-[#142C4E]">
              Todavía no hay productos en {category}
            </h3>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              Esta sección ya está lista. Cuando agregues productos de esta
              categoría desde el panel, aparecerán acá automáticamente.
            </p>
          </div>
        ) : (
          <div className="group relative">
            <button
              type="button"
              onClick={() => scrollProducts("left")}
              aria-label={`Ver productos anteriores de ${category}`}
              className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[#142C4E] shadow-md transition hover:bg-[#142C4E] hover:text-white md:flex"
            >
              <ChevronLeft size={21} />
            </button>

            <div
              ref={scrollRef}
              className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-4 sm:gap-5"
              style={{ scrollbarWidth: "none" }}
            >
              {categoryProducts.map((product) => {
                const quantity = quantityForProduct(product.id);
                const hasDiscount = product.originalPrice > product.price;
                const discount = hasDiscount
                  ? Math.round((1 - product.price / product.originalPrice) * 100)
                  : 0;

                return (
                  <article
                    key={product.id}
                    className="group/card relative flex w-[155px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-[205px] sm:rounded-3xl"
                  >
                    <button
                      type="button"
                      onClick={() => onViewProduct(product)}
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
                        onClick={() => onViewProduct(product)}
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
                        onClick={() => onAddToCart(product)}
                        disabled={quantity >= product.stock}
                        className="mt-3 flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-[#142C4E] px-2 py-2 text-[11px] font-bold text-white transition hover:bg-[#10489f] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:gap-2 sm:text-xs"
                      >
                        <Plus size={15} strokeWidth={2.5} />
                        {product.stock <= 0
                          ? "Sin stock"
                          : quantity >= product.stock
                            ? `${quantity} en el carrito`
                            : quantity
                              ? `${quantity} en carrito · Agregar`
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
              aria-label={`Ver más productos de ${category}`}
              className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-[#142C4E] shadow-md transition hover:bg-[#142C4E] hover:text-white md:flex"
            >
              <ChevronRight size={21} />
            </button>
          </div>
        )}

        {!loading && categoryProducts.length > 0 && (
          <button
            type="button"
            onClick={() => onSeeCategory(category)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#10489f] transition hover:gap-2.5"
          >
            Ver toda la categoría <ArrowRight size={14} />
          </button>
        )}
      </div>
    </section>
  );
}
