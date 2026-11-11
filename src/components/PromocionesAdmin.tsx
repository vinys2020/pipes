import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { AlertCircle, LoaderCircle, Percent, Search, Tag } from "lucide-react";
import { db } from "../firebase/config";

type ProductoPromo = {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  active: boolean;
};

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export default function PromocionesAdmin() {
  const [productos, setProductos] = useState<ProductoPromo[]>([]);
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        const lista = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: String(data.name ?? ""),
            category: String(data.category ?? ""),
            price: Number(data.price ?? 0),
            originalPrice: Number(data.originalPrice ?? 0),
            active: data.active !== false,
          };
        });
        setProductos(lista);
        setPrecios((current) => {
          const next = { ...current };
          lista.forEach((product) => {
            if (!(product.id in next)) {
              next[product.id] = String(
                product.originalPrice > product.price
                  ? product.originalPrice
                  : ""
              );
            }
          });
          return next;
        });
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("Error al cargar productos para promociones:", snapshotError);
        setError("No se pudieron cargar las promociones.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    return productos.filter((product) =>
      `${product.name} ${product.category}`.toLowerCase().includes(term)
    );
  }, [productos, search]);

  const guardarPromocion = async (producto: ProductoPromo) => {
    const raw = precios[producto.id]?.trim() ?? "";
    const precioAnterior = raw ? Number(raw) : 0;
    if (
      raw &&
      (!Number.isFinite(precioAnterior) || precioAnterior <= producto.price)
    ) {
      setError(
        `El precio anterior de ${producto.name} debe ser mayor al precio actual (${money(producto.price)}).`
      );
      return;
    }

    setGuardando(producto.id);
    setError("");
    setMensaje("");
    try {
      await updateDoc(doc(db, "productos", producto.id), {
        originalPrice: precioAnterior,
        updatedAt: serverTimestamp(),
      });
      setMensaje(
        raw
          ? `Promoción de ${producto.name} actualizada.`
          : `Se quitó la promoción de ${producto.name}.`
      );
    } catch (actionError) {
      console.error("Error al guardar promoción:", actionError);
      setError("No se pudo guardar la promoción.");
    } finally {
      setGuardando("");
    }
  };

  const promocionesActivas = productos.filter(
    (product) => product.active && product.originalPrice > product.price
  ).length;

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#10489f]">
            <Tag size={17} /> OFERTAS
          </p>
          <h2 className="text-2xl font-black text-[#142c4e] sm:text-3xl">
            Promociones del catálogo
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Definí un precio anterior mayor al precio vigente para mostrar una oferta.
          </p>
        </div>
        <p className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#142c4e] shadow-sm">
          {promocionesActivas} promociones activas
        </p>
      </header>

      <label className="relative block">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar producto..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[#10489f]"
        />
      </label>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} /> {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
          {mensaje}
        </p>
      )}
      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <LoaderCircle className="animate-spin text-[#10489f]" size={28} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {filtrados.map((producto) => {
              const promocionActiva =
                producto.active && producto.originalPrice > producto.price;
              return (
                <article
                  key={producto.id}
                  className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_180px_170px_auto] md:items-center md:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#142c4e]">
                      {producto.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {producto.category} · Precio actual: {money(producto.price)}
                    </p>
                  </div>
                  <label className="text-xs font-bold text-slate-600">
                    Precio anterior
                    <input
                      type="number"
                      min={producto.price + 1}
                      step="1"
                      value={precios[producto.id] ?? ""}
                      onChange={(event) =>
                        setPrecios((current) => ({
                          ...current,
                          [producto.id]: event.target.value,
                        }))
                      }
                      placeholder="Sin promoción"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-[#10489f]"
                    />
                  </label>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                      promocionActiva ? "text-green-700" : "text-slate-400"
                    }`}
                  >
                    <Percent size={14} />
                    {promocionActiva ? "Oferta visible en tienda" : "Sin promoción"}
                  </span>
                  <button
                    type="button"
                    disabled={guardando === producto.id || !producto.active}
                    onClick={() => void guardarPromocion(producto)}
                    className="rounded-lg bg-[#142c4e] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#10489f] disabled:opacity-50"
                  >
                    {guardando === producto.id ? "Guardando..." : "Guardar"}
                  </button>
                </article>
              );
            })}
            {filtrados.length === 0 && (
              <p className="p-10 text-center text-sm text-slate-500">
                No hay productos que coincidan.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
