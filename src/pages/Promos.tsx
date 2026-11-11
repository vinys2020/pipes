import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgePercent,
  Image as ImageIcon,
  LoaderCircle,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useNotifications } from "../components/useNotifications";
import { usePersistedCart } from "../hooks/usePersistedCart";
import { mapStoreProduct, type StoreProduct } from "../lib/storefront";
import { db } from "../firebase/config";

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

function PromoProduct({
  product,
  quantity,
  onAdd,
}: {
  product: StoreProduct;
  quantity: number;
  onAdd: () => void;
}) {
  const discount = Math.round(
    (1 - product.price / product.originalPrice) * 100
  );

  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-[#eef4ff] to-[#f8faff] p-6 sm:p-9">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
          />
        ) : (
          <ImageIcon size={56} className="text-slate-300" />
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#D5FF45] px-3 py-1.5 text-xs font-black text-[#142C4E] shadow">
          <BadgePercent size={14} /> -{discount}%
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#10489f]">
          {product.category}
        </p>
        <h2 className="mt-1 min-h-11 text-base font-extrabold text-[#142C4E]">
          {product.name}
        </h2>
        <p className="mt-1 text-xs text-slate-400 line-through">
          Antes {money(product.originalPrice)}
        </p>
        <div className="mt-0.5 flex items-end justify-between gap-2">
          <p className="text-2xl font-black text-[#10489f]">
            {money(product.price)}
          </p>
          <p className="pb-1 text-[10px] font-bold text-emerald-700">
            Ahorrás {money(product.originalPrice - product.price)}
          </p>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {product.stock > 0 ? `${product.stock} disponibles` : "Sin stock"}
        </p>
        <button
          type="button"
          onClick={onAdd}
          disabled={product.stock <= quantity}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#142C4E] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-[#10489f] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          <ShoppingBag size={16} />
          {product.stock <= quantity
            ? product.stock === 0
              ? "Sin stock"
              : "En tu carrito"
            : quantity
              ? `${quantity} en carrito · agregar`
              : "Aprovechar oferta"}
        </button>
      </div>
    </article>
  );
}

export default function Promos() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { cartCount, quantities, addProduct } = usePersistedCart();
  const { notify } = useNotifications();

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        setProducts(
          snapshot.docs
            .map((item) => mapStoreProduct(item.id, item.data()))
            .filter(
              (product) =>
                product.active &&
                product.name &&
                product.price > 0 &&
                product.originalPrice > product.price
            )
            .sort(
              (a, b) =>
                (b.originalPrice - b.price) / b.originalPrice -
                (a.originalPrice - a.price) / a.originalPrice
            )
        );
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error al cargar las promociones:", snapshotError);
        setError("No pudimos cargar las promociones. Intentá nuevamente.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const filteredPromos = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    if (!term) return products;
    return products.filter((product) =>
      `${product.name} ${product.category} ${product.description}`
        .toLocaleLowerCase("es")
        .includes(term)
    );
  }, [products, search]);

  const categories = [...new Set(products.map((product) => product.category))].map(
    (name) => ({ name, icon: "" })
  );

  return (
    <main className="min-h-screen bg-[#F5F7FA] pb-28 text-[#142C4E]">
      <div className="bg-[#142C4E] px-4 py-2 text-center text-[11px] font-semibold text-white">
        <span className="inline-flex items-center gap-2">
          <Sparkles size={14} className="text-[#D5FF45]" />
          Ofertas reales del catálogo PIPES
        </span>
      </div>
      <Navbar
        search={search}
        setSearch={setSearch}
        cartCount={cartCount}
        activeCategory="Todos"
        setActiveCategory={() => undefined}
        categories={categories}
        onCartClick={() => navigate("/")}
      />

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-9 lg:px-10">
        <section className="relative isolate overflow-hidden rounded-[30px] bg-[#102e5c] text-white shadow-[0_24px_60px_rgba(16,46,92,.16)]">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_12%,rgba(213,255,69,.28),transparent_30%),linear-gradient(115deg,#102e5c,#10489f)]" />
          <div className="grid items-center gap-6 px-6 py-9 sm:px-10 sm:py-12 md:grid-cols-[1fr_auto] md:px-14">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#D5FF45]">
                <BadgePercent size={15} />
                Precios especiales
              </span>
              <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">
                Buenas compras.
                <span className="block text-[#D5FF45]">Mejores precios.</span>
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base">
                Aprovechá las ofertas activas del catálogo y sumá tus favoritos
                al carrito antes de que se terminen.
              </p>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("promos-list")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#D5FF45] px-5 py-3 text-sm font-black text-[#142C4E] transition hover:-translate-y-0.5"
              >
                Ver ofertas <ArrowRight size={17} />
              </button>
            </div>
            <div className="hidden h-40 w-40 items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 text-[#D5FF45] shadow-xl backdrop-blur md:flex">
              <BadgePercent size={86} strokeWidth={1.4} />
            </div>
          </div>
        </section>

        <section id="promos-list" className="mt-9 scroll-mt-24">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[1.7px] text-[#10489f]">
                Selección para vos
              </p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                Promociones activas
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {products.length} {products.length === 1 ? "oferta disponible" : "ofertas disponibles"}
              </p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar ofertas..."
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#10489f] sm:w-72"
            />
          </div>

          {loading ? (
            <div className="flex min-h-56 items-center justify-center rounded-2xl bg-white">
              <LoaderCircle size={30} className="animate-spin text-[#10489f]" />
            </div>
          ) : error ? (
            <p role="alert" className="rounded-2xl bg-red-50 p-5 text-sm text-red-700">
              {error}
            </p>
          ) : filteredPromos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {filteredPromos.map((product) => (
                <PromoProduct
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
              <BadgePercent size={34} className="mx-auto text-slate-300" />
              <h3 className="mt-3 font-bold">
                {products.length ? "No encontramos esa oferta" : "Todavía no hay ofertas activas"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Las promociones aparecen acá cuando hay un precio anterior mayor al actual.
              </p>
              <button
                type="button"
                onClick={() => navigate("/mercado")}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#10489f]"
              >
                Ir al mercado <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>

        <div className="mt-8 rounded-2xl bg-[#EAF2FF] p-4 text-center text-xs font-semibold text-[#142C4E]">
          {cartCount} {cartCount === 1 ? "producto" : "productos"} en tu carrito.{" "}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="font-black text-[#10489f] underline underline-offset-2"
          >
            Revisar mi compra
          </button>
        </div>
      </div>
    </main>
  );
}
