import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { AlertCircle, BarChart3, Clock3, LoaderCircle, Store } from "lucide-react";
import CajaVentas from "./CajaVentas";
import { db } from "../firebase/config";

type Venta = {
  id: string;
  numero?: string;
  total?: number;
  metodoPago?: string;
  tipo?: string;
  estado?: string;
  usuarioEmail?: string;
  creadoEn?: { toDate?: () => Date };
  items?: { nombre?: string; cantidad?: number }[];
};

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export default function VentasAdmin() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mostrarCaja, setMostrarCaja] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "ventas"),
      (snapshot) => {
        const lista = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }) as Venta)
          .sort(
            (a, b) =>
              (b.creadoEn?.toDate?.().getTime() ?? 0) -
              (a.creadoEn?.toDate?.().getTime() ?? 0)
          );
        setVentas(lista);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error("Error al cargar ventas:", snapshotError);
        setError("No se pudieron cargar las ventas. Revisá las reglas de Firestore.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const ventasDelDia = useMemo(() => {
    const hoy = new Date();
    return ventas.filter((venta) => {
      const fecha = venta.creadoEn?.toDate?.();
      return (
        fecha &&
        fecha.getFullYear() === hoy.getFullYear() &&
        fecha.getMonth() === hoy.getMonth() &&
        fecha.getDate() === hoy.getDate()
      );
    });
  }, [ventas]);
  const totalDelDia = ventasDelDia.reduce(
    (total, venta) => total + Number(venta.total ?? 0),
    0
  );

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#10489f]">
            <BarChart3 size={17} /> MOVIMIENTO COMERCIAL
          </p>
          <h2 className="text-2xl font-black text-[#142c4e] sm:text-3xl">
            Ventas
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Historial de ventas del local y registro en caja.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarCaja((open) => !open)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#142c4e] px-4 py-3 text-sm font-bold text-white hover:bg-[#10489f]"
        >
          <Store size={17} />
          {mostrarCaja ? "Ocultar caja" : "Abrir caja"}
        </button>
      </header>

      {mostrarCaja && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <CajaVentas />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">Ventas de hoy</p>
          <p className="mt-2 text-3xl font-black text-[#142c4e]">
            {ventasDelDia.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">Ingresos del día</p>
          <p className="mt-2 text-3xl font-black text-[#10489f]">
            {money(totalDelDia)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-500">Ventas registradas</p>
          <p className="mt-2 text-3xl font-black text-[#142c4e]">{ventas.length}</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} /> {error}
        </p>
      )}
      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <LoaderCircle className="animate-spin text-[#10489f]" size={28} />
        </div>
      ) : ventas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <BarChart3 className="mx-auto text-slate-300" size={36} />
          <p className="mt-3 font-bold text-[#142c4e]">Todavía no hay ventas</p>
          <p className="mt-1 text-sm text-slate-500">
            Las ventas de caja aparecerán automáticamente en este historial.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {ventas.map((venta) => (
              <article
                key={venta.id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:px-5"
              >
                <div>
                  <p className="font-bold text-[#142c4e]">
                    Venta #{(venta.numero || venta.id).slice(0, 10)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock3 size={13} />
                    {venta.creadoEn?.toDate
                      ? new Intl.DateTimeFormat("es-AR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(venta.creadoEn.toDate())
                      : "Fecha no disponible"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {venta.items?.map((item) => `${item.nombre} × ${item.cantidad}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <div className="text-right">
                    <p className="text-xs capitalize text-slate-500">
                      {venta.metodoPago || "Pago no informado"} · {venta.tipo || "venta"}
                    </p>
                    <p className="font-black text-[#10489f]">
                      {money(Number(venta.total ?? 0))}
                    </p>
                  </div>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                    {venta.estado || "Completada"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
