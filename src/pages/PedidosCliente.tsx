import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useNotifications } from "../components/useNotifications";
import { usePersistedCart } from "../hooks/usePersistedCart";
import {
  mapStoreProduct,
} from "../lib/storefront";
import { auth } from "../firebase/auth";
import { db } from "../firebase/config";

type CustomerOrderItem = {
  productoId?: string;
  nombre?: string;
  imagen?: string;
  precio?: number;
  cantidad?: number;
  subtotal?: number;
};

type CustomerOrder = {
  id: string;
  numero?: string;
  items?: CustomerOrderItem[];
  total?: number;
  estado?: string;
  creadoEn?: { toDate?: () => Date };
  entrega?: {
    tipo?: "retiro" | "envio";
    direccion?: string;
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);

const dateLabel = (timestamp?: CustomerOrder["creadoEn"]) =>
  timestamp?.toDate
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(timestamp.toDate())
    : "Fecha no disponible";

const statusDetails: Record<string, { label: string; className: string }> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  confirmado: {
    label: "Confirmado",
    className: "bg-blue-50 text-blue-800 ring-blue-200",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-red-50 text-red-800 ring-red-200",
  },
  completado: {
    label: "Completado",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
};

export default function PedidosCliente() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [repeatingOrder, setRepeatingOrder] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { cartCount, quantities, addItems } = usePersistedCart();
  const { notify } = useNotifications();

  useEffect(
    () =>
      onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (!currentUser) navigate("/login", { replace: true });
      }),
    [navigate]
  );

  useEffect(() => {
    if (!user) return;
    const ordersQuery = query(
      collection(db, "pedidos"),
      where("cliente.uid", "==", user.uid)
    );
    return onSnapshot(
      ordersQuery,
      (snapshot) => {
        const customerOrders = snapshot.docs.map((orderDoc) => ({
          id: orderDoc.id,
          ...orderDoc.data(),
        })) as CustomerOrder[];
        customerOrders.sort(
          (a, b) =>
            (b.creadoEn?.toDate?.().getTime() ?? 0) -
            (a.creadoEn?.toDate?.().getTime() ?? 0)
        );
        setOrders(customerOrders);
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error al cargar el historial de pedidos:", snapshotError);
        setError("No pudimos cargar tus pedidos. Intentá nuevamente.");
        setLoading(false);
      }
    );
  }, [user]);

  const repeatOrder = async (order: CustomerOrder) => {
    if (repeatingOrder) return;
    setRepeatingOrder(order.id);

    try {
      const sourceItems = order.items ?? [];
      const itemResults = await Promise.all(
        sourceItems.map(async (item) => {
          if (
            !item.productoId ||
            !Number.isInteger(item.cantidad) ||
            (item.cantidad ?? 0) <= 0
          ) {
            return { product: null, quantity: 0 };
          }

          const productSnapshot = await getDoc(
            doc(db, "productos", item.productoId)
          );
          if (!productSnapshot.exists()) {
            return { product: null, quantity: 0 };
          }

          const product = mapStoreProduct(
            productSnapshot.id,
            productSnapshot.data()
          );
          return {
            product:
              product.active && product.stock > 0 && product.price > 0
                ? product
                : null,
            quantity: item.cantidad ?? 0,
          };
        })
      );

      const availableItems = itemResults.flatMap((item) =>
        item.product
          ? [{ product: item.product, quantity: item.quantity }]
          : []
      );

      if (!availableItems.length) {
        notify(
          "error",
          "Los productos de este pedido ya no están disponibles."
        );
        return;
      }

      const next = addItems(availableItems);
      const addedUnits = availableItems.reduce(
        (total, item) =>
          total +
          Math.max(
            0,
            (next[item.product.id] ?? 0) -
              (quantities[item.product.id] ?? 0)
          ),
        0
      );
      const unavailableCount = sourceItems.length - availableItems.length;

      if (addedUnits === 0) {
        notify(
          "info",
          "Tu carrito ya tiene la cantidad máxima disponible de estos productos."
        );
        return;
      }

      notify(
        unavailableCount > 0 ? "info" : "success",
        unavailableCount > 0
          ? `Se agregaron ${addedUnits} unidades. ${unavailableCount} producto(s) no están disponibles.`
          : `Se agregaron ${addedUnits} unidades del pedido a tu carrito.`
      );
      navigate("/");
    } catch (repeatError) {
      console.error("No se pudo repetir el pedido:", repeatError);
      notify("error", "No se pudo repetir el pedido. Intentá nuevamente.");
    } finally {
      setRepeatingOrder("");
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F7FA] pb-28 text-[#142C4E]">
      <div className="bg-[#142C4E] px-4 py-2 text-center text-[11px] font-semibold text-white">
        <span className="inline-flex items-center gap-2">
          <ShoppingBag size={14} className="text-[#D5FF45]" />
          Tus compras, siempre a mano
        </span>
      </div>
      <Navbar
        search={search}
        setSearch={setSearch}
        cartCount={cartCount}
        activeCategory="Todos"
        setActiveCategory={() => undefined}
        categories={[]}
        onCartClick={() => navigate("/")}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-[#10489f] transition hover:text-[#142C4E]"
        >
          <ArrowLeft size={16} /> Volver al mercado
        </button>

        <header className="relative overflow-hidden rounded-3xl bg-[#102e5c] px-6 py-8 text-white shadow-[0_20px_50px_rgba(16,46,92,.15)] sm:px-9 sm:py-10">
          <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[30px] border-white/[0.05]" />
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[1.7px] text-[#D5FF45]">
                Mi actividad
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Mis pedidos
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/75">
                Revisá tus compras anteriores, consultá su estado y repetí un
                pedido cuando quieras.
              </p>
            </div>
            {!loading && (
              <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-extrabold text-white ring-1 ring-white/15">
                {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
              </span>
            )}
          </div>
        </header>

        {loading ? (
          <div className="mt-6 flex min-h-56 items-center justify-center gap-3 rounded-2xl bg-white text-sm font-semibold text-slate-500">
            <LoaderCircle size={20} className="animate-spin text-[#10489f]" />
            Cargando tu historial…
          </div>
        ) : error ? (
          <div role="alert" className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <ShoppingBag size={36} className="mx-auto text-slate-300" />
            <h2 className="mt-4 text-lg font-black">Todavía no tenés pedidos</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cuando hagas tu primera compra, vas a poder consultarla desde acá.
            </p>
            <button
              type="button"
              onClick={() => navigate("/mercado")}
              className="mt-5 rounded-xl bg-[#10489f] px-5 py-3 text-sm font-bold text-white"
            >
              Explorar mercado
            </button>
          </div>
        ) : (
          <section className="mt-6 space-y-4">
            {orders.map((order) => {
              const status = statusDetails[order.estado ?? ""] ?? {
                label: order.estado || "Estado no disponible",
                className: "bg-slate-100 text-slate-700 ring-slate-200",
              };
              const items = order.items ?? [];
              const busy = repeatingOrder === order.id;

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <header className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:px-5">
                    <div>
                      <p className="text-sm font-black text-[#142C4E]">
                        Pedido #{order.numero || order.id}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Clock3 size={13} /> {dateLabel(order.creadoEn)}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full px-3 py-1.5 text-[11px] font-extrabold ring-1 ring-inset ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </header>

                  <div className="space-y-3 p-4 sm:px-5">
                    {items.slice(0, 3).map((item, index) => (
                      <div
                        key={`${item.productoId || item.nombre || "item"}-${index}`}
                        className="flex items-center gap-3"
                      >
                        {item.imagen ? (
                          <img
                            src={item.imagen}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-xl bg-slate-50 object-contain p-1"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#10489f]">
                            <Package size={20} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#142C4E]">
                            {item.nombre || "Producto"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.cantidad ?? 0} × {money(item.precio ?? 0)}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#142C4E]">
                          {money(item.subtotal ?? (item.cantidad ?? 0) * (item.precio ?? 0))}
                        </span>
                      </div>
                    ))}
                    {items.length > 3 && (
                      <p className="pl-1 text-xs font-semibold text-slate-500">
                        + {items.length - 3} productos más
                      </p>
                    )}
                  </div>

                  <footer className="flex flex-col justify-between gap-3 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:px-5">
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        {order.entrega?.tipo === "envio" ? (
                          <Truck size={14} className="text-[#10489f]" />
                        ) : (
                          <MapPin size={14} className="text-[#10489f]" />
                        )}
                        {order.entrega?.tipo === "envio"
                          ? `Envío · ${order.entrega.direccion || "Dirección registrada"}`
                          : "Retiro en el local"}
                      </p>
                      <p className="text-sm font-black text-[#142C4E]">
                        Total: {money(order.total ?? 0)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void repeatOrder(order)}
                      disabled={busy || items.length === 0}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#10489f] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#142C4E] disabled:cursor-wait disabled:opacity-60"
                    >
                      {busy ? (
                        <LoaderCircle size={15} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={15} />
                      )}
                      {busy ? "Revisando disponibilidad…" : "Repetir pedido"}
                    </button>
                  </footer>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
