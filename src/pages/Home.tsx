import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  Clock3,
  Heart,
  Image as ImageIcon,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  ShieldCheck,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useNotifications } from "../components/useNotifications";
import ChocolatesGolosinas from "../components/ChocolatesGolosinas";
import {
  type CategoryShelfProps,
} from "../components/CategoryProductShelf";
import Almacen from "../components/Almacen";
import Analgesicos from "../components/Analgesicos";
import Bebidas from "../components/Bebidas";
import Cigarrillos from "../components/Cigarrillos";
import CuidadoPersonal from "../components/CuidadoPersonal";
import Limpieza from "../components/Limpieza";
import Ofertas from "../components/Ofertas";
import OtrosProductos from "../components/OtrosProductos";
import Pizzas from "../components/Pizzas";
import SnacksGalletitas from "../components/SnacksGalletitas";
import {
  getStoreCategories,
  productMatchesCategory,
} from "../lib/storefront";
import ProductoDetalle from "./ProductoDetalle";
import type { ProductoDetalleData } from "./ProductoDetalle";
import { auth } from "../firebase/auth";
import { db } from "../firebase/config";

type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  category: string;
  description: string;
  stock: number;
  numeroProducto: string;
  identificador: string;
};

type CheckoutForm = {
  nombre: string;
  telefono: string;
  tipoEntrega: "retiro" | "envio";
  direccion: string;
  notas: string;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);

const playOrderBell = (audioContext: AudioContext) => {
  try {
    const startAt = audioContext.currentTime;
    [880, 1174, 1568].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      const noteStart = startAt + index * 0.12;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, noteStart);
      volume.gain.exponentialRampToValueAtTime(0.16, noteStart + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.55);
      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.56);
    });
    window.setTimeout(() => {
      void audioContext.close();
    }, 1000);
  } catch (audioError) {
    console.warn("No se pudo reproducir el sonido del pedido:", audioError);
    if (audioContext.state !== "closed") void audioContext.close();
  }
};

const toProductDetail = (product: Product): ProductoDetalleData => ({
  id: product.id,
  nombre: product.name,
  precio: product.price,
  precioAnterior: product.originalPrice,
  imagen: product.image,
  categoria: product.category,
  descripcion: product.description,
  stock: product.stock,
});

function ProductCard({
  product,
  quantity,
  favorite,
  onAdd,
  onRemove,
  onFavorite,
  onView,
}: {
  product: Product;
  quantity: number;
  favorite: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onFavorite: () => void;
  onView: () => void;
}) {
  const discount =
    product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition duration-300 hover:-translate-y-1 hover:border-[#10489f]/25 hover:shadow-[0_18px_45px_rgba(20,44,78,.10)]">
      <button
        type="button"
        onClick={onView}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[#F7F9FC] p-4"
        aria-label={`Ver ${product.name}`}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain mix-blend-multiply transition duration-500 group-hover:scale-105"
          />
        ) : (
          <ImageIcon className="text-slate-300" size={40} />
        )}
        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-md bg-[#D5FF45] px-2 py-1 text-[10px] font-extrabold text-[#142C4E]">
            -{discount}%
          </span>
        )}
      </button>

      <button
        type="button"
        aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
        onClick={onFavorite}
        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border bg-white/90 transition hover:scale-105 ${
          favorite
            ? "border-rose-200 text-rose-500"
            : "border-slate-200 text-slate-500"
        }`}
      >
        <Heart size={15} fill={favorite ? "currentColor" : "none"} />
      </button>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-slate-400">
          {product.category || "Otros"}
        </p>
        <button
          type="button"
          onClick={onView}
          className="mt-1.5 min-h-[40px] text-left text-sm font-semibold leading-5 text-[#142C4E]"
        >
          {product.name}
        </button>
        {product.description && (
          <p className="mt-1 line-clamp-2 min-h-8 text-xs text-slate-500">
            {product.description}
          </p>
        )}
        <div className="mt-3">
          {discount > 0 && (
            <p className="text-xs text-slate-400 line-through">
              {formatPrice(product.originalPrice)}
            </p>
          )}
          <p className="text-xl font-extrabold tracking-tight text-[#142C4E]">
            {formatPrice(product.price)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {product.stock > 0 ? `${product.stock} disponibles` : "Sin stock"}
          </p>
        </div>
        <div className="mt-auto pt-4">
          {quantity === 0 ? (
            <button
              type="button"
              onClick={onAdd}
              disabled={product.stock <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#10489f] px-3 py-2.5 text-xs font-bold text-[#10489f] transition hover:bg-[#10489f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} />
              {product.stock > 0 ? "Agregar" : "Sin stock"}
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-xl bg-[#10489f] p-1 text-white">
              <button
                type="button"
                onClick={onRemove}
                aria-label="Quitar una unidad"
                className="flex h-8 w-9 items-center justify-center rounded-lg hover:bg-white/15"
              >
                <Minus size={15} />
              </button>
              <span className="text-sm font-bold">{quantity} en el carrito</span>
              <button
                type="button"
                onClick={onAdd}
                disabled={quantity >= product.stock}
                aria-label="Agregar una unidad"
                className="flex h-8 w-9 items-center justify-center rounded-lg hover:bg-white/15 disabled:opacity-50"
              >
                <Plus size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    try {
      const savedCart = sessionStorage.getItem("pipes-cart");
      if (!savedCart) return {};

      const parsed: unknown = JSON.parse(savedCart);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return {};
      }

      return Object.fromEntries(
        Object.entries(parsed).filter(
          ([id, quantity]) =>
            id.length > 0 &&
            typeof quantity === "number" &&
            Number.isInteger(quantity) &&
            quantity > 0
        )
      );
    } catch (error) {
      console.error("No se pudo recuperar el carrito guardado:", error);
      return {};
    }
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [confirmedOrderId, setConfirmedOrderId] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    nombre: "",
    telefono: "",
    tipoEntrega: "retiro",
    direccion: "",
    notas: "",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { notify } = useNotifications();

  const productRouteId = location.pathname.startsWith("/producto/")
    ? decodeURIComponent(location.pathname.slice("/producto/".length))
    : "";
  const productoSeleccionado =
    products.find((product) => product.id === productRouteId) ?? null;

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
              category: String(data.category ?? "Otros"),
              description: String(data.description ?? ""),
              stock: Number(data.stock ?? 0),
              numeroProducto: String(data.numeroProducto ?? ""),
              identificador: String(data.identificador ?? ""),
              active: data.active !== false,
            };
          })
          .filter((product) => product.active && product.name && product.price > 0)
          .sort((a, b) => a.name.localeCompare(b.name, "es"))
          .map(
            ({
              id,
              name,
              price,
              originalPrice,
              image,
              category,
              description,
              stock,
              numeroProducto,
              identificador,
            }) => ({
              id,
              name,
              price,
              originalPrice,
              image,
              category,
              description,
              stock,
              numeroProducto,
              identificador,
            })
          );
        setProducts(catalog);
        setCatalogError("");
        setLoadingProducts(false);
      },
      (error) => {
        console.error("Error al cargar productos:", error);
        setCatalogError("No pudimos cargar el catálogo. Intentá nuevamente.");
        setLoadingProducts(false);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  useEffect(() => {
    try {
      sessionStorage.setItem("pipes-cart", JSON.stringify(quantities));
    } catch (error) {
      console.error("No se pudo guardar el carrito en esta sesión:", error);
    }
  }, [quantities]);

  useEffect(() => {
    if (location.pathname === "/") {
      const state = location.state as { scrollTo?: string } | null;
      if (state?.scrollTo) {
        requestAnimationFrame(() => {
          document.getElementById(state.scrollTo!)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location.pathname, location.state]);

  const categories = useMemo(
    () => getStoreCategories(products.map((product) => product.category)),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "Todos" ||
        productMatchesCategory(product, activeCategory);
      const searchable =
        `${product.name} ${product.description} ${product.category} ${product.numeroProducto} ${product.identificador}`.toLowerCase();
      return matchesCategory && (!term || searchable.includes(term));
    });
  }, [products, activeCategory, search]);

  const cartItems = useMemo(
    () =>
      products.flatMap((product) => {
        const quantity = quantities[product.id] ?? 0;
        return quantity > 0 ? [{ product, quantity }] : [];
      }),
    [products, quantities]
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const addProduct = (product: Product, quantity = 1) => {
    setQuantities((current) => ({
      ...current,
      [product.id]: Math.min(
        product.stock,
        (current[product.id] ?? 0) + quantity
      ),
    }));
  };

  const removeProduct = (productId: string) => {
    setQuantities((current) => {
      const next = { ...current };
      const quantity = (next[productId] ?? 0) - 1;
      if (quantity <= 0) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  };

  const openCheckout = async () => {
    setCheckoutOpen(true);
    setCheckoutError("");
    if (currentUser) {
      try {
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        const data = userDoc.exists() ? userDoc.data() : {};
        setCheckoutForm((current) => ({
          ...current,
          nombre:
            current.nombre ||
            String(data.nombre ?? currentUser.displayName ?? ""),
          telefono: current.telefono || String(data.telefono ?? ""),
        }));
      } catch (error) {
        console.error("No se pudieron cargar los datos del cliente:", error);
        setCheckoutError(
          "No pudimos cargar tus datos. Podés completarlos manualmente."
        );
      }
    }
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCheckoutError("");

    if (!currentUser) {
      setCheckoutError("Iniciá sesión o creá una cuenta para enviar el pedido.");
      return;
    }
    if (cartItems.length === 0) {
      setCheckoutError("Tu carrito está vacío.");
      return;
    }
    const nombre = checkoutForm.nombre.trim();
    const telefono = checkoutForm.telefono.trim();
    const direccion = checkoutForm.direccion.trim();
    if (!nombre || !telefono) {
      setCheckoutError("Completá tu nombre y teléfono.");
      return;
    }
    if (checkoutForm.tipoEntrega === "envio" && !direccion) {
      setCheckoutError("Ingresá la dirección para el envío.");
      return;
    }

    setSubmittingOrder(true);
    let audioContext: AudioContext | null = null;
    try {
      if (typeof AudioContext !== "undefined") {
        audioContext = new AudioContext();
        void audioContext.resume().catch((audioError: unknown) => {
          console.warn("No se pudo habilitar el sonido del pedido:", audioError);
        });
      }
    } catch (audioError) {
      console.warn("No se pudo preparar el sonido del pedido:", audioError);
    }

    try {
      const orderRef = doc(collection(db, "pedidos"));
      await runTransaction(db, async (transaction) => {
        const productRefs = cartItems.map(({ product }) =>
          doc(db, "productos", product.id)
        );
        const productSnapshots = await Promise.all(
          productRefs.map((productRef) => transaction.get(productRef))
        );
        const items = cartItems.map(({ quantity }, index) => {
          const snapshot = productSnapshots[index];
          if (!snapshot.exists()) {
            throw new Error("Un producto del carrito ya no está disponible.");
          }
          const data = snapshot.data();
          const stock = Number(data.stock ?? 0);
          const price = Number(data.price ?? 0);
          if (data.active === false || stock < quantity || price <= 0) {
            throw new Error(
              `${String(data.name ?? "Un producto")} ya no tiene stock suficiente. Revisá tu carrito.`
            );
          }
          return {
            productoId: snapshot.id,
            numeroProducto: String(data.numeroProducto ?? ""),
            identificador: String(data.identificador ?? ""),
            nombre: String(data.name ?? ""),
            imagen: String(data.image ?? ""),
            precio: price,
            cantidad: quantity,
            subtotal: price * quantity,
          };
        });
        const total = items.reduce((sum, item) => sum + item.subtotal, 0);
        transaction.set(orderRef, {
          numero: orderRef.id,
          cliente: {
            uid: currentUser.uid,
            nombre,
            email: currentUser.email ?? "",
            telefono,
          },
          entrega: {
            tipo: checkoutForm.tipoEntrega,
            direccion: checkoutForm.tipoEntrega === "envio" ? direccion : "",
          },
          notas: checkoutForm.notas.trim(),
          items,
          cantidadProductos: items.reduce(
            (sum, item) => sum + item.cantidad,
            0
          ),
          subtotal: total,
          total,
          estado: "pendiente",
          creadoEn: serverTimestamp(),
        });
      });

      setQuantities({});
      setConfirmedOrderId(orderRef.id);
      setCheckoutOpen(false);
      setCheckoutForm((current) => ({ ...current, notas: "" }));
      notify(
        "success",
        "¡Pedido enviado! El comercio recibió tu solicitud."
      );
      if (audioContext) playOrderBell(audioContext);
    } catch (error) {
      console.error("Error al enviar el pedido:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No se pudo enviar el pedido. Intentá nuevamente.";
      setCheckoutError(errorMessage);
      notify("error", errorMessage);
      if (audioContext && audioContext.state !== "closed") {
        void audioContext.close();
      }
    } finally {
      setSubmittingOrder(false);
    }
  };

  const openProduct = (product: { id: string }) => {
    navigate(`/producto/${encodeURIComponent(product.id)}`);
  };

  const productsForRelated = products.map((product) => ({
    id: product.id,
    nombre: product.name,
    precio: product.price,
    precioAnterior: product.originalPrice,
    imagen: product.image,
    categoria: product.category,
    descripcion: product.description,
  }));

  const navbarCategories = categories.map((name) => ({ name, icon: "" }));
  const categoryShelfProps: CategoryShelfProps = {
    products,
    loading: loadingProducts,
    onAddToCart: (categoryProduct) => {
      const product = products.find((item) => item.id === categoryProduct.id);
      if (product) addProduct(product);
    },
    onViewProduct: (product) => openProduct(product),
    quantityForProduct: (id) => quantities[id] ?? 0,
    onSeeCategory: (category) =>
      navigate(`/mercado?categoria=${encodeURIComponent(category)}`),
  };

  return (
    <main className="min-h-screen bg-[#F5F7FA] pb-48 text-[#142C4E] md:pb-24">
      <div className="bg-[#142C4E] px-4 py-2 text-center text-[11px] font-medium tracking-wide text-white sm:text-xs">
        <span className="inline-flex items-center justify-center gap-2">
          <Truck size={14} className="text-[#D5FF45]" />
          Comprá fácil, rápido y sin vueltas
          <span className="hidden text-white/50 sm:inline">·</span>
          <span className="hidden text-[#D5FF45] sm:inline">
            Todo lo que necesitás, en un solo lugar
          </span>
        </span>
      </div>

      <Navbar
        search={search}
        setSearch={setSearch}
        cartCount={cartCount}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        categories={navbarCategories}
        onCartClick={() => void openCheckout()}
      />

      {productoSeleccionado ? (
        <ProductoDetalle
          producto={toProductDetail(productoSeleccionado)}
          productosRelacionados={productsForRelated}
          onVerProductoRelacionado={(product) => openProduct(product)}
          onVolver={() => navigate("/", { state: { scrollTo: "productos" } })}
          onAgregarAlCarrito={(product, quantity) => {
            const found = products.find((item) => item.id === product.id);
            if (found) addProduct(found, quantity);
            navigate("/");
          }}
        />
      ) : productRouteId && loadingProducts ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoaderCircle className="animate-spin text-[#10489f]" size={32} />
        </div>
      ) : (
        <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 sm:pt-7 lg:px-10">
          <section className="relative isolate overflow-hidden rounded-[30px] bg-[#0B1E3B] text-white shadow-[0_28px_70px_rgba(11,30,59,.2)]">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_18%,rgba(31,111,235,.65),transparent_35%),radial-gradient(ellipse_at_98%_100%,rgba(16,72,159,.7),transparent_48%)]" />
            <div className="absolute inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:linear-gradient(90deg,transparent,black)]" />
            <div className="absolute -right-28 -top-32 -z-10 h-96 w-96 rounded-full border border-white/10 md:h-[34rem] md:w-[34rem]" />
            <div className="absolute -right-12 -top-16 -z-10 h-72 w-72 rounded-full border border-white/[0.07] md:h-[26rem] md:w-[26rem]" />

            <div className="grid min-h-[570px] items-center gap-2 px-6 py-9 sm:px-10 sm:py-12 md:min-h-[470px] md:grid-cols-[1.05fr_.95fr] md:gap-0 md:px-14 lg:px-[4.5rem]">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[1.35px] text-white/90 backdrop-blur sm:text-[11px]">
                  <Sparkles size={14} className="text-[#D5FF45]" />
                  Tu compra, más simple
                </div>

                <h1 className="mt-6 max-w-xl text-[2.65rem] font-black leading-[.99] tracking-[-.055em] sm:text-6xl lg:text-[4.4rem]">
                  Tu tienda de confianza,
                  <span className="mt-1 block text-[#D5FF45]">
                    pipes.
                  </span>
                </h1>
                <p className="mt-5 max-w-md text-sm leading-6 text-blue-50/75 sm:text-base sm:leading-7">
                  Encontrá tus productos de siempre, descubrí ofertas y armá tu
                  pedido en minutos. Comprar en PIPES es así de fácil.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("productos")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#D5FF45] px-5 py-3.5 text-sm font-black text-[#142C4E] shadow-[0_10px_30px_rgba(213,255,69,.17)] transition hover:-translate-y-0.5 hover:bg-[#e2ff76] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Empezar a comprar
                    <ArrowRight
                      size={17}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => void openCheckout()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.07] px-5 py-3.5 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/[0.13] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <ShoppingBag size={17} />
                    Ver mi carrito
                    {cartCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D5FF45] px-1 text-[10px] font-black text-[#142C4E]">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/10 pt-5 text-[11px] font-semibold text-white/70 sm:gap-x-7">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck size={15} className="text-[#D5FF45]" />
                    Pedido directo al comercio
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock3 size={15} className="text-[#D5FF45]" />
                    Rápido y sin vueltas
                  </span>
                </div>
              </div>

              <div className="relative mx-auto mt-3 flex h-[280px] w-full max-w-[410px] items-center justify-center sm:h-[340px] md:mt-0 md:h-[390px]">
                <div className="absolute h-52 w-52 rounded-full bg-[#1f6feb]/35 blur-3xl sm:h-64 sm:w-64" />
                <div className="absolute h-56 w-56 rounded-full border border-white/10 sm:h-72 sm:w-72" />
                <div className="absolute h-44 w-44 rounded-full border border-white/[0.08] sm:h-60 sm:w-60" />

                <div className="relative flex h-40 w-40 -rotate-6 items-center justify-center rounded-[42px] border border-white/20 bg-gradient-to-br from-white/25 to-white/[0.06] shadow-[0_28px_70px_rgba(0,0,0,.25)] backdrop-blur-xl transition duration-500 hover:rotate-0 sm:h-48 sm:w-48">
                  <div className="absolute inset-2 rounded-[34px] border border-white/10" />
                  <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#D5FF45] text-[#142C4E] shadow-[0_15px_40px_rgba(213,255,69,.25)] sm:h-28 sm:w-28">
                    <ShoppingBasket
                      size={56}
                      strokeWidth={1.8}
                      className="sm:hidden"
                    />
                    <ShoppingBasket
                      size={66}
                      strokeWidth={1.8}
                      className="hidden sm:block"
                    />
                  </div>
                  <span className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/30 bg-white text-[#10489f] shadow-lg sm:h-12 sm:w-12">
                    <BadgePercent size={24} />
                  </span>
                  <span className="absolute -bottom-3 -left-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-[#10489f] text-white shadow-lg sm:h-12 sm:w-12">
                    <CheckCircle2 size={22} />
                  </span>
                </div>

                {products[0] && (
                  <div className="absolute left-0 top-7 flex max-w-[190px] -rotate-3 items-center gap-2.5 rounded-2xl border border-white/70 bg-white p-2.5 text-[#142C4E] shadow-xl sm:left-1 sm:top-9 sm:max-w-[210px] sm:gap-3 sm:p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3F6FB] sm:h-12 sm:w-12">
                      {products[0].image ? (
                        <img
                          src={products[0].image}
                          alt=""
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <ShoppingBag size={19} className="text-[#10489f]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold text-slate-500">
                        Del catálogo
                      </p>
                      <p className="truncate text-xs font-black">
                        {products[0].name}
                      </p>
                      <p className="text-[11px] font-extrabold text-[#10489f]">
                        {formatPrice(products[0].price)}
                      </p>
                    </div>
                  </div>
                )}

                {products[1] && (
                  <div className="absolute bottom-8 right-0 flex max-w-[190px] rotate-3 items-center gap-2.5 rounded-2xl border border-white/70 bg-white p-2.5 text-[#142C4E] shadow-xl sm:bottom-10 sm:right-0 sm:max-w-[210px] sm:gap-3 sm:p-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F3F6FB] sm:h-12 sm:w-12">
                      {products[1].image ? (
                        <img
                          src={products[1].image}
                          alt=""
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <ShoppingBag size={19} className="text-[#10489f]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold text-slate-500">
                        Elegí tus favoritos
                      </p>
                      <p className="truncate text-xs font-black">
                        {products[1].name}
                      </p>
                      <p className="text-[11px] font-extrabold text-[#10489f]">
                        {formatPrice(products[1].price)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="absolute right-2 top-7 flex items-center gap-2 rounded-full border border-white/15 bg-[#142C4E]/80 px-3 py-2 text-[10px] font-bold text-white shadow-lg backdrop-blur sm:right-1 sm:top-12 sm:px-3.5 sm:text-[11px]">
                  <span className="h-2 w-2 rounded-full bg-[#D5FF45] shadow-[0_0_10px_rgba(213,255,69,.8)]" />
                  {loadingProducts
                    ? "Cargando catálogo"
                    : `${products.length} productos disponibles`}
                </div>

                <div className="absolute bottom-3 left-1 rounded-full border border-white/15 bg-[#142C4E]/80 px-3.5 py-2 text-[10px] font-bold text-white shadow-lg backdrop-blur sm:bottom-5 sm:left-0 sm:px-4 sm:text-[11px]">
                  {cartCount > 0
                    ? `${cartCount} ${cartCount === 1 ? "producto" : "productos"} en tu carrito`
                    : "Envios y retiros sin complicaciones"}
                </div>
              </div>
            </div>
          </section>

          <section id="productos" className="mt-10 scroll-mt-36 sm:mt-14">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[1.8px] text-[#10489f]">
                  Catálogo actualizado
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                  {search
                    ? "Resultados de búsqueda"
                    : activeCategory === "Todos"
                      ? "Productos disponibles"
                      : activeCategory}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredProducts.length} productos encontrados
                </p>
              </div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {["Todos", ...categories].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-bold transition ${
                      activeCategory === category
                        ? "bg-[#142C4E] text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-[#10489f] hover:text-[#10489f]"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {catalogError ? (
              <div role="alert" className="rounded-2xl bg-red-50 p-6 text-sm text-red-700">
                {catalogError}
              </div>
            ) : loadingProducts ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={index}
                    className="h-72 animate-pulse rounded-2xl bg-slate-200"
                  />
                ))}
              </div>
            ) : filteredProducts.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={quantities[product.id] ?? 0}
                    favorite={favorites.includes(product.id)}
                    onAdd={() => addProduct(product)}
                    onRemove={() => removeProduct(product.id)}
                    onFavorite={() =>
                      setFavorites((current) =>
                        current.includes(product.id)
                          ? current.filter((id) => id !== product.id)
                          : [...current, product.id]
                      )
                    }
                    onView={() => openProduct(product)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
                <Search size={28} className="mx-auto text-slate-300" />
                <h3 className="mt-3 text-sm font-bold">
                  {products.length ? "No encontramos productos" : "Catálogo sin productos"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {products.length
                    ? "Probá con otra búsqueda o categoría."
                    : "Cuando el administrador cargue productos, aparecerán aquí."}
                </p>
                {products.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setActiveCategory("Todos");
                    }}
                    className="mt-4 rounded-lg bg-[#10489f] px-4 py-2 text-xs font-bold text-white"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </section>

          <ChocolatesGolosinas
            onAddToCart={(product) => {
              const found = products.find((item) => item.id === product.id);
              if (found) addProduct(found);
            }}
            onViewProduct={openProduct}
            quantityForProduct={(id) => quantities[id] ?? 0}
          />

          <Ofertas {...categoryShelfProps} />
          <Almacen {...categoryShelfProps} />
          <Bebidas {...categoryShelfProps} />
          <SnacksGalletitas {...categoryShelfProps} />
          <Pizzas {...categoryShelfProps} />
          <Cigarrillos {...categoryShelfProps} />
          <CuidadoPersonal {...categoryShelfProps} />
          <Limpieza {...categoryShelfProps} />
          <Analgesicos {...categoryShelfProps} />
          <OtrosProductos {...categoryShelfProps} />

          <footer className="mt-12 border-t border-slate-200 py-7 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} PIPES. Todos los derechos reservados.
          </footer>
        </div>
      )}

      {confirmedOrderId && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-confirmation-title"
          className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-[#F5F7FA] px-5 py-10 text-center"
        >
          <div className="w-full max-w-lg">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[#EAF2FF] shadow-[0_0_0_12px_rgba(16,72,159,.06)]">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#10489f] text-white shadow-lg">
                <CheckCircle2 size={48} strokeWidth={2.5} />
              </span>
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[.18em] text-[#10489f]">
              Pedido enviado
            </p>
            <h1
              id="order-confirmation-title"
              className="mt-2 text-3xl font-black text-[#142C4E] sm:text-4xl"
            >
              ¡Listo, recibimos tu pedido!
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
              El comercio revisará el stock y el precio. Podés seguir el estado
              y los productos desde tu perfil.
            </p>
            <p className="mt-4 text-xs font-bold text-slate-500">
              Número de pedido: <span className="text-[#142C4E]">{confirmedOrderId}</span>
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/cliente")}
                className="rounded-xl bg-[#10489f] px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#142C4E]"
              >
                Ver mis pedidos
              </button>
              <button
                type="button"
                onClick={() => setConfirmedOrderId("")}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-[#142C4E] transition hover:bg-slate-50"
              >
                Seguir comprando
              </button>
            </div>
          </div>
        </section>
      )}

      {cartCount > 0 ? (
        <div className="fixed inset-x-0 bottom-[108px] z-[60] border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_28px_rgba(20,44,78,.12)] backdrop-blur md:bottom-0 md:px-6">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#10489f]">
                <ShoppingBag size={21} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[#142C4E]">
                  Tu pedido · {cartCount} {cartCount === 1 ? "producto" : "productos"}
                </p>
                <p className="text-xs text-slate-500">
                  Total: <strong className="text-[#142C4E]">{formatPrice(cartTotal)}</strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void openCheckout()}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-[#142C4E] px-4 py-3 text-xs font-extrabold text-white transition hover:bg-[#10489f] sm:px-6 sm:text-sm"
            >
              Ver carrito <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void openCheckout()}
          aria-label="Abrir carrito vacío"
          className="fixed bottom-[118px] right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#142C4E] text-white shadow-xl transition hover:scale-105 hover:bg-[#10489f] md:bottom-6 md:right-6"
        >
          <ShoppingBag size={23} />
        </button>
      )}

      {checkoutOpen && (
        <div
          className="fixed inset-0 z-[80] flex justify-end bg-slate-950/50"
          onClick={(event) => {
            if (event.target === event.currentTarget && !submittingOrder) {
              setCheckoutOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            className="h-full max-h-screen w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="cart-title" className="text-xl font-black">
                  Mi carrito
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {cartCount} unidades · {formatPrice(cartTotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                disabled={submittingOrder}
                aria-label="Cerrar carrito"
                className="rounded-xl bg-slate-100 p-2 text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {checkoutError && (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {checkoutError}
              </p>
            )}

            {cartItems.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-8 text-center">
                <ShoppingBag className="mx-auto text-slate-300" size={36} />
                <p className="mt-3 font-bold">Tu carrito está vacío</p>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  className="mt-4 rounded-xl bg-[#142C4E] px-4 py-2.5 text-sm font-bold text-white"
                >
                  Seguir comprando
                </button>
              </div>
            ) : (
              <>
                <ul className="mb-5 max-h-60 space-y-3 overflow-y-auto">
                  {cartItems.map(({ product, quantity }) => (
                    <li
                      key={product.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt=""
                          className="h-14 w-14 rounded-lg bg-slate-50 object-contain"
                        />
                      ) : (
                        <ImageIcon className="mx-4 text-slate-300" size={24} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {quantity} × {formatPrice(product.price)}
                        </p>
                      </div>
                      <p className="text-sm font-black">
                        {formatPrice(quantity * product.price)}
                      </p>
                      <div className="flex items-center rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => removeProduct(product.id)}
                          aria-label={`Quitar una unidad de ${product.name}`}
                          className="px-2 py-1.5 text-[#142C4E] hover:bg-slate-50"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-6 text-center text-xs font-bold">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => addProduct(product)}
                          disabled={quantity >= product.stock}
                          aria-label={`Agregar una unidad de ${product.name}`}
                          className="px-2 py-1.5 text-[#142C4E] hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setQuantities((current) => {
                            const next = { ...current };
                            delete next[product.id];
                            return next;
                          })
                        }
                        aria-label={`Quitar ${product.name}`}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mb-5 flex justify-between border-t border-slate-200 pt-4 text-base font-black">
                  <span>Total</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>

                {!currentUser ? (
                  <div className="rounded-xl bg-blue-50 p-4 text-sm text-[#142C4E]">
                    <p className="font-bold">
                      Iniciá sesión para enviar el pedido.
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Si todavía no tenés cuenta, podés registrarte gratis.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="rounded-lg bg-[#142C4E] px-4 py-2 text-xs font-bold text-white"
                      >
                        Iniciar sesión
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate("/registro")}
                        className="rounded-lg border border-[#142C4E] px-4 py-2 text-xs font-bold"
                      >
                        Crear cuenta
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitOrder} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-bold">
                        Nombre *
                        <input
                          value={checkoutForm.nombre}
                          onChange={(event) =>
                            setCheckoutForm((current) => ({
                              ...current,
                              nombre: event.target.value,
                            }))
                          }
                          required
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#10489f]"
                        />
                      </label>
                      <label className="text-xs font-bold">
                        Teléfono *
                        <input
                          value={checkoutForm.telefono}
                          onChange={(event) =>
                            setCheckoutForm((current) => ({
                              ...current,
                              telefono: event.target.value,
                            }))
                          }
                          required
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#10489f]"
                        />
                      </label>
                    </div>

                    <fieldset>
                      <legend className="mb-2 text-xs font-bold">
                        ¿Cómo recibís tu compra?
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {(["retiro", "envio"] as const).map((tipo) => (
                          <label
                            key={tipo}
                            className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${
                              checkoutForm.tipoEntrega === tipo
                                ? "border-[#10489f] bg-blue-50 text-[#10489f]"
                                : "border-slate-200"
                            }`}
                          >
                            <input
                              type="radio"
                              name="tipoEntrega"
                              value={tipo}
                              checked={checkoutForm.tipoEntrega === tipo}
                              onChange={() =>
                                setCheckoutForm((current) => ({
                                  ...current,
                                  tipoEntrega: tipo,
                                }))
                              }
                              className="sr-only"
                            />
                            {tipo === "retiro" ? "Retiro en el local" : "Envío"}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {checkoutForm.tipoEntrega === "envio" && (
                      <label className="block text-xs font-bold">
                        Dirección de entrega *
                        <input
                          value={checkoutForm.direccion}
                          onChange={(event) =>
                            setCheckoutForm((current) => ({
                              ...current,
                              direccion: event.target.value,
                            }))
                          }
                          required
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#10489f]"
                        />
                      </label>
                    )}

                    <label className="block text-xs font-bold">
                      Nota (opcional)
                      <textarea
                        value={checkoutForm.notas}
                        onChange={(event) =>
                          setCheckoutForm((current) => ({
                            ...current,
                            notas: event.target.value,
                          }))
                        }
                        rows={2}
                        maxLength={500}
                        className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#10489f]"
                      />
                    </label>

                    <p className="text-xs text-slate-500">
                      El pedido quedará pendiente hasta que el comercio
                      confirme el stock y el precio.
                    </p>
                    <button
                      type="submit"
                      disabled={submittingOrder}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#142C4E] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#10489f] disabled:opacity-60"
                    >
                      {submittingOrder ? (
                        <LoaderCircle className="animate-spin" size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      {submittingOrder ? "Enviando pedido..." : "Enviar pedido"}
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
