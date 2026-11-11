import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { useNotifications } from "./useNotifications";
import { db } from "../firebase/config";

type EstadoPedido = "pendiente" | "confirmado" | "cancelado" | "completado";

type PedidoItem = {
  productoId: string;
  numeroProducto: string;
  identificador: string;
  nombre: string;
  imagen: string;
  precio: number;
  cantidad: number;
  subtotal: number;
};

type Pedido = {
  id: string;
  numero: string;
  cliente: {
    uid: string;
    nombre: string;
    email: string;
    telefono: string;
  };
  entrega: {
    tipo: "retiro" | "envio";
    direccion: string;
  };
  notas: string;
  items: PedidoItem[];
  cantidadProductos: number;
  total: number;
  estado: EstadoPedido;
  creadoEn?: { toDate?: () => Date };
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);

const formatDate = (timestamp?: Pedido["creadoEn"]) =>
  timestamp?.toDate
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(timestamp.toDate())
    : "Fecha no disponible";

const estadoLabel: Record<EstadoPedido, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  completado: "Completado",
};

export default function PedidosAdmin() {
  const { notify } = useNotifications();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [pedidoEnProceso, setPedidoEnProceso] = useState("");
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<"todos" | EstadoPedido>("todos");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "pedidos"),
      (snapshot) => {
        const lista = snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
        })) as Pedido[];
        lista.sort(
          (a, b) =>
            (b.creadoEn?.toDate?.().getTime() ?? 0) -
            (a.creadoEn?.toDate?.().getTime() ?? 0)
        );
        setPedidos(lista);
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error al cargar pedidos:", snapshotError);
        setError("No se pudieron cargar los pedidos. Revisá las reglas de Firestore.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const cambiarEstado = async (
    pedido: Pedido,
    nuevoEstado: "confirmado" | "cancelado" | "completado"
  ) => {
    if (pedidoEnProceso) return;
    setPedidoEnProceso(pedido.id);
    setError("");

    try {
      const pedidoRef = doc(db, "pedidos", pedido.id);
      await runTransaction(db, async (transaction) => {
        const pedidoActual = await transaction.get(pedidoRef);
        if (!pedidoActual.exists()) {
          throw new Error("El pedido ya no existe.");
        }

        const estadoActual = pedidoActual.data().estado as EstadoPedido;
        const confirmar = estadoActual === "pendiente" && nuevoEstado === "confirmado";
        const cancelar =
          (estadoActual === "pendiente" || estadoActual === "confirmado") &&
          nuevoEstado === "cancelado";
        const completar =
          estadoActual === "confirmado" && nuevoEstado === "completado";
        if (!confirmar && !cancelar && !completar) {
          throw new Error("El estado del pedido cambió. Actualizá la página.");
        }

        const items = (pedidoActual.data().items ?? []) as PedidoItem[];
        if (confirmar || (cancelar && estadoActual === "confirmado")) {
          if (
            items.length === 0 ||
            items.length > 50 ||
            new Set(items.map((item) => item.productoId)).size !== items.length ||
            items.some(
              (item) =>
                !item.productoId ||
                !Number.isInteger(item.cantidad) ||
                item.cantidad <= 0
            )
          ) {
            throw new Error("El pedido contiene productos o cantidades inválidas.");
          }

          const productoRefs = items.map((item) =>
            doc(db, "productos", item.productoId)
          );
          const productoDocs = await Promise.all(
            productoRefs.map((productoRef) => transaction.get(productoRef))
          );

          if (confirmar) {
            for (let index = 0; index < items.length; index += 1) {
              const productDoc = productoDocs[index];
              if (!productDoc.exists()) {
                throw new Error(`El producto "${items[index].nombre}" ya no existe.`);
              }
              const stock = Number(productDoc.data().stock ?? 0);
              if (productDoc.data().active === false || stock < items[index].cantidad) {
                throw new Error(
                  `Stock insuficiente de "${items[index].nombre}". Disponible: ${stock}.`
                );
              }
            }
            const itemsConfirmados = items.map((item, index) => {
              const productData = productoDocs[index].data()!;
              const precio = Number(productData.price ?? 0);
              if (!Number.isFinite(precio) || precio <= 0) {
                throw new Error(
                  `El precio de "${items[index].nombre}" no es válido.`
                );
              }
              return {
                ...item,
                numeroProducto: String(productData.numeroProducto ?? ""),
                identificador: String(productData.identificador ?? ""),
                nombre: String(productData.name ?? ""),
                imagen: String(productData.image ?? ""),
                precio,
                subtotal: precio * item.cantidad,
              };
            });
            const totalConfirmado = itemsConfirmados.reduce(
              (total, item) => total + item.subtotal,
              0
            );
            productoDocs.forEach((productDoc, index) => {
              transaction.update(productoRefs[index], {
                stock:
                  Number(productDoc.data()?.stock ?? 0) - items[index].cantidad,
                updatedAt: serverTimestamp(),
              });
            });
            transaction.update(pedidoRef, {
              estado: nuevoEstado,
              items: itemsConfirmados,
              cantidadProductos: itemsConfirmados.reduce(
                (total, item) => total + item.cantidad,
                0
              ),
              subtotal: totalConfirmado,
              total: totalConfirmado,
              actualizadoEn: serverTimestamp(),
            });
          } else {
            productoDocs.forEach((productDoc, index) => {
              if (productDoc.exists()) {
                transaction.update(productoRefs[index], {
                  stock:
                    Number(productDoc.data().stock ?? 0) + items[index].cantidad,
                  updatedAt: serverTimestamp(),
                });
              }
            });
          }
        }

        if (!confirmar) {
          transaction.update(pedidoRef, {
            estado: nuevoEstado,
            actualizadoEn: serverTimestamp(),
          });
        }
      });
      notify(
        "success",
        `Pedido #${pedido.numero || pedido.id}: estado actualizado a ${estadoLabel[nuevoEstado].toLowerCase()}.`
      );
    } catch (actionError) {
      console.error("Error al actualizar pedido:", actionError);
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo actualizar el pedido."
      );
      notify(
        "error",
        actionError instanceof Error
          ? actionError.message
          : "No se pudo actualizar el pedido."
      );
    } finally {
      setPedidoEnProceso("");
    }
  };

  const pedidosFiltrados =
    filtro === "todos"
      ? pedidos
      : pedidos.filter((pedido) => pedido.estado === filtro);

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#10489f]">
            <ShoppingBag size={17} /> VENTAS ONLINE
          </p>
          <h2 className="text-2xl font-black text-[#142c4e] sm:text-3xl">
            Pedidos de clientes
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Confirmar un pedido reserva y descuenta sus productos del stock.
          </p>
        </div>
        <label className="text-xs font-bold text-slate-600">
          Mostrar
          <select
            value={filtro}
            onChange={(event) =>
              setFiltro(event.target.value as "todos" | EstadoPedido)
            }
            className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="todos">Todos ({pedidos.length})</option>
            <option value="pendiente">
              Pendientes ({pedidos.filter((pedido) => pedido.estado === "pendiente").length})
            </option>
            <option value="confirmado">Confirmados</option>
            <option value="completado">Completados</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </label>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Cerrar error"
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-56 items-center justify-center">
          <LoaderCircle className="animate-spin text-[#10489f]" size={30} />
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <Package className="mx-auto text-slate-300" size={38} />
          <h3 className="mt-3 font-bold text-[#142c4e]">No hay pedidos para mostrar</h3>
          <p className="mt-1 text-sm text-slate-500">
            Los pedidos enviados desde la tienda aparecerán aquí en tiempo real.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados.map((pedido) => {
            const busy = pedidoEnProceso === pedido.id;
            return (
              <article
                key={pedido.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5">
                  <div>
                    <p className="font-black text-[#142c4e]">
                      Pedido #{pedido.numero || pedido.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 size={13} /> {formatDate(pedido.creadoEn)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        pedido.estado === "pendiente"
                          ? "bg-amber-50 text-amber-700"
                          : pedido.estado === "confirmado"
                            ? "bg-blue-50 text-blue-700"
                            : pedido.estado === "completado"
                              ? "bg-green-50 text-green-700"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {estadoLabel[pedido.estado] ?? pedido.estado}
                    </span>
                    <span className="text-lg font-black text-[#10489f]">
                      {formatPrice(pedido.total)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-5 p-4 sm:grid-cols-[1fr_260px] sm:p-5">
                  {pedido.estado === "pendiente" && (
                    <p className="text-xs text-amber-700 sm:col-span-2">
                      El importe y el stock se validarán al confirmar el pedido.
                    </p>
                  )}
                  <div className="space-y-3">
                    {pedido.items.map((item) => (
                      <div
                        key={item.productoId}
                        className="flex items-center gap-3 text-sm"
                      >
                        {item.imagen ? (
                          <img
                            src={item.imagen}
                            alt=""
                            className="h-12 w-12 rounded-lg bg-slate-50 object-contain"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50">
                            <Package className="text-slate-300" size={20} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#142c4e]">{item.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {item.cantidad} × {formatPrice(item.precio)}
                            {item.numeroProducto &&
                              ` · N.º ${item.numeroProducto}`}
                          </p>
                        </div>
                        <span className="font-bold">
                          {formatPrice(item.subtotal)}
                        </span>
                      </div>
                    ))}
                    {pedido.notas && (
                      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <strong>Nota:</strong> {pedido.notas}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                    <p className="font-bold text-[#142c4e]">{pedido.cliente?.nombre}</p>
                    {pedido.cliente?.telefono && (
                      <p className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone size={14} /> {pedido.cliente.telefono}
                      </p>
                    )}
                    {pedido.cliente?.email && (
                      <p className="break-all text-xs text-slate-600">
                        {pedido.cliente.email}
                      </p>
                    )}
                    <p className="flex items-center gap-2 border-t border-slate-200 pt-2 text-xs font-semibold text-slate-700">
                      {pedido.entrega?.tipo === "envio" ? (
                        <Truck size={14} />
                      ) : (
                        <MapPin size={14} />
                      )}
                      {pedido.entrega?.tipo === "envio"
                        ? pedido.entrega.direccion
                        : "Retiro en el local"}
                    </p>
                  </div>
                </div>

                {pedido.estado === "pendiente" && (
                  <div className="flex flex-col justify-end gap-2 border-t border-slate-100 p-4 sm:flex-row">
                    <button
                      type="button"
                      disabled={busy || Boolean(pedidoEnProceso)}
                      onClick={() => void cambiarEstado(pedido, "cancelado")}
                      className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Rechazar pedido
                    </button>
                    <button
                      type="button"
                      disabled={busy || Boolean(pedidoEnProceso)}
                      onClick={() => void cambiarEstado(pedido, "confirmado")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#142c4e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#10489f] disabled:opacity-50"
                    >
                      {busy ? (
                        <LoaderCircle className="animate-spin" size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Confirmar y descontar stock
                    </button>
                  </div>
                )}

                {pedido.estado === "confirmado" && (
                  <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
                    <button
                      type="button"
                      disabled={busy || Boolean(pedidoEnProceso)}
                      onClick={() => void cambiarEstado(pedido, "cancelado")}
                      className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancelar y devolver stock
                    </button>
                    <button
                      type="button"
                      disabled={busy || Boolean(pedidoEnProceso)}
                      onClick={() => void cambiarEstado(pedido, "completado")}
                      className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Marcar completado
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
