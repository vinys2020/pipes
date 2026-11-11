import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  Image as ImageIcon,
  LoaderCircle,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useNotifications } from "../components/useNotifications";
import { usePersistedCart } from "../hooks/usePersistedCart";
import {
  getProductsForCategory,
  getStoreCategories,
  mapStoreProduct,
  normalizeCategoryName,
  productMatchesCategory,
  type StoreProduct,
} from "../lib/storefront";
import { db } from "../firebase/config";

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

function ProductTile({
  product,
  quantity,
  onAdd,
}: {
  product: StoreProduct;
  quantity: number;
  onAdd: () => void;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative flex aspect-[1/1] items-center justify-center overflow-hidden bg-gradient-to-br from-white to-[#edf3fc] p-5 sm:aspect-[4/3] sm:p-7">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
          />
        ) : (
          <ImageIcon size={42} className="text-slate-300" />
        )}
        {product.originalPrice > product.price && (
          <span className="absolute left-3 top-3 rounded-full bg-[#D5FF45] px-2.5 py-1 text-[10px] font-black text-[#142C4E]">
            OFERTA
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#10489f]">
          {product.category}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-bold text-[#142C4E]">
          {product.name}
        </h3>
        <p className="mt-1 text-[11px] text-slate-500">
          {product.stock > 0 ? `${product.stock} disponibles` : "Sin stock"}
        </p>
        <div className="mt-3">
          {product.originalPrice > product.price && (
            <p className="text-xs text-slate-400 line-through">
              {money(product.originalPrice)}
            </p>
          )}
          <p className="text-xl font-black text-[#142C4E]">
            {money(product.price)}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={product.stock <= quantity}
          className="mt-4 flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#10489f] px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#142C4E] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          <ShoppingBag size={15} />
          {product.stock <= quantity
            ? product.stock === 0
              ? "Sin stock"
              : "En tu carrito"
            : quantity
              ? `${quantity} en carrito · agregar`
              : "Agregar al carrito"}
        </button>
      </div>
    </article>
  );
}

export default function Mercado() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { cartCount, quantities, addProduct } = usePersistedCart();
  const { notify } = useNotifications();
  const categoryParam = searchParams.get("categoria") ?? "Todos";
  const selectedCategory = categoryParam;
  const search = searchParams.get("q") ?? "";
  const setSearch = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("q", value);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        setProducts(
          snapshot.docs
            .map((item) => mapStoreProduct(item.id, item.data()))
            .filter((product) => product.active && product.name && product.price > 0)
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
        );
        setCatalogError("");
        setLoading(false);
      },
      (error) => {
        console.error("Error al cargar productos del mercado:", error);
        setCatalogError("No pudimos cargar el mercado. Intentá nuevamente.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const categories = useMemo(
    () => getStoreCategories(products.map((product) => product.category)),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "Todos" ||
        productMatchesCategory(product, selectedCategory);
      const searchable =
        `${product.name} ${product.description} ${product.category} ${product.numeroProducto}`.toLocaleLowerCase(
          "es"
        );
      return matchesCategory && (!term || searchable.includes(term));
    });
  }, [products, search, selectedCategory]);

  const selectCategory = (category: string) => {
    const next = new URLSearchParams(searchParams);
    if (category === "Todos") next.delete("categoria");
    else next.set("categoria", category);
    setSearchParams(next, { replace: true });
    document.getElementById("productos-mercado")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const navbarCategories = categories.map((name) => ({ name, icon: "" }));

  return (
    <main className="min-h-screen bg-[#F5F7FA] pb-28 text-[#142C4E]">
      <div className="bg-[#142C4E] px-4 py-2 text-center text-[11px] font-semibold text-white">
        <span className="inline-flex items-center gap-2">
          <ShoppingBasket size={14} className="text-[#D5FF45]" />
          Tu súper de todos los días, ahora más fácil
        </span>
      </div>
      <Navbar
        search={search}
        setSearch={setSearch}
        cartCount={cartCount}
        activeCategory={selectedCategory}
        setActiveCategory={selectCategory}
        categories={navbarCategories}
        onCartClick={() => navigate("/")}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-9 lg:px-10">
        <section className="relative isolate overflow-hidden rounded-[30px] bg-[#102e5c] text-white shadow-[0_24px_60px_rgba(16,46,92,.16)]">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_12%,rgba(213,255,69,.25),transparent_30%),linear-gradient(115deg,#102e5c,#10489f)]" />
          <div className="grid items-center gap-6 px-6 py-8 sm:px-10 sm:py-10 md:grid-cols-[1fr_auto] md:px-12">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#D5FF45]">
                <Sparkles size={14} />
                Mercado PIPES
              </span>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
                Tus compras, a tu manera.
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/75 sm:text-base">
                Explorá por categoría, encontrá tus favoritos y sumalos al
                carrito en un toque.
              </p>
            </div>
            <div className="hidden h-36 w-36 items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 text-[#D5FF45] shadow-xl backdrop-blur md:flex">
              <ShoppingBasket size={76} strokeWidth={1.5} />
            </div>
          </div>
        </section>

        <section className="mt-9" aria-labelledby="market-categories-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[1.7px] text-[#10489f]">
                Encontrá lo que buscás
              </p>
              <h2
                id="market-categories-title"
                className="mt-1 text-2xl font-black sm:text-3xl"
              >
                Comprá por categoría
              </h2>
            </div>
            <button
              type="button"
              onClick={() => selectCategory("Todos")}
              className="hidden items-center gap-1 text-xs font-bold text-[#10489f] sm:flex"
            >
              Ver todo <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center rounded-2xl bg-white">
              <LoaderCircle size={28} className="animate-spin text-[#10489f]" />
            </div>
          ) : catalogError ? (
            <p role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">
              {catalogError}
            </p>
          ) : categories.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
              Todavía no hay categorías disponibles.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {categories.map((category, index) => {
                        const categoryProducts = getProductsForCategory(products, category);
                        const sampleImages = categoryProducts
                  .filter((product) => product.image)
                  .slice(0, 3);
                const active =
                  normalizeCategoryName(selectedCategory) ===
                  normalizeCategoryName(category);

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => selectCategory(category)}
                    className={`group relative flex min-h-[190px] flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl sm:min-h-[230px] ${
                      active
                        ? "border-[#10489f] ring-2 ring-[#10489f]/20"
                        : "border-slate-200"
                    }`}
                  >
                    <div
                      className={`relative flex flex-1 items-center justify-center overflow-hidden ${
                        index % 3 === 0
                          ? "bg-[#EAF2FF]"
                          : index % 3 === 1
                            ? "bg-[#F3F4E9]"
                            : "bg-[#FFF2E8]"
                      }`}
                    >
                      {sampleImages.length > 0 ? (
                        <div className="flex h-full w-full items-center justify-center gap-[-12px] px-2">
                          {sampleImages.map((product, imageIndex) => (
                            <img
                              key={product.id}
                              src={product.image}
                              alt=""
                              loading="lazy"
                              className={`h-24 w-20 object-contain drop-shadow-lg transition duration-300 group-hover:-translate-y-1 sm:h-32 sm:w-24 ${
                                imageIndex === 1
                                  ? "z-10 scale-110"
                                  : imageIndex === 0
                                    ? "-mr-5 -rotate-6"
                                    : "-ml-5 rotate-6"
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <ShoppingBasket
                          size={56}
                          strokeWidth={1.3}
                          className="text-[#10489f]/35"
                        />
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-extrabold text-[#142C4E] shadow-sm">
                        {categoryProducts.length} artículos
                      </span>
                    </div>
                    <div className="flex min-h-[58px] items-center justify-between gap-2 px-3 py-3 sm:px-4">
                      <span className="line-clamp-2 text-xs font-black text-[#142C4E] sm:text-sm">
                        {category}
                      </span>
                      <ArrowRight
                        size={16}
                        className="shrink-0 text-[#10489f] transition-transform group-hover:translate-x-1"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section
          id="productos-mercado"
          className="mt-10 scroll-mt-24"
          aria-labelledby="market-products-title"
        >
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[1.7px] text-[#10489f]">
                {selectedCategory === "Todos" ? "Todo el catálogo" : "Categoría"}
              </p>
              <h2
                id="market-products-title"
                className="mt-1 text-2xl font-black sm:text-3xl"
              >
                {selectedCategory === "Todos"
                  ? "Todos los productos"
                  : selectedCategory}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {filteredProducts.length} productos para elegir
              </p>
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#10489f] sm:w-80">
              <Search size={17} className="shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar en el mercado..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center rounded-2xl bg-white">
              <LoaderCircle size={28} className="animate-spin text-[#10489f]" />
            </div>
          ) : catalogError ? null : filteredProducts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => (
                <ProductTile
                  key={product.id}
                  product={product}
                  quantity={quantities[product.id] ?? 0}
                  onAdd={() => {
                    if (addProduct(product)) {
                      notify("success", `${product.name} agregado al carrito.`);
                    } else {
                      notify("info", "No hay más unidades disponibles de este producto.");
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Search size={28} className="mx-auto text-slate-300" />
              <h3 className="mt-3 text-sm font-bold">
                No encontramos productos
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  selectCategory("Todos");
                }}
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#10489f]"
              >
                <ChevronLeft size={14} />
                Ver todo el mercado
              </button>
            </div>
          )}
        </section>

        <div className="mt-8 rounded-2xl bg-[#EAF2FF] p-4 text-center text-xs font-semibold text-[#142C4E] sm:p-5">
          Tu carrito tiene {cartCount}{" "}
          {cartCount === 1 ? "producto" : "productos"}. Al terminar, volvé al
          inicio para revisar y enviar tu pedido.
        </div>
      </div>
    </main>
  );
}
