import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Search, UserRound, Users, LoaderCircle, AlertCircle } from "lucide-react";
import { db } from "../firebase/config";

type Cliente = {
  id: string;
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  rol?: string;
  activo?: boolean;
  creadoEn?: { toDate?: () => Date };
};

export default function ClientesAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "usuarios"),
      (snapshot) => {
        setClientes(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }) as Cliente)
            .filter((cliente) => cliente.rol === "cliente")
            .sort(
              (a, b) =>
                (b.creadoEn?.toDate?.().getTime() ?? 0) -
                (a.creadoEn?.toDate?.().getTime() ?? 0)
            )
        );
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error al cargar clientes:", snapshotError);
        setError("No se pudieron cargar los clientes. Revisá las reglas de Firestore.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const filtrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clientes.filter((cliente) =>
      `${cliente.nombre ?? ""} ${cliente.email ?? ""} ${cliente.telefono ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [clientes, search]);

  const cambiarEstado = async (cliente: Cliente) => {
    setActualizando(cliente.id);
    setError("");
    try {
      await updateDoc(doc(db, "usuarios", cliente.id), {
        activo: cliente.activo === false,
        actualizadoEn: serverTimestamp(),
      });
    } catch (actionError) {
      console.error("Error al cambiar estado del cliente:", actionError);
      setError("No se pudo actualizar el cliente.");
    } finally {
      setActualizando("");
    }
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#10489f]">
            <Users size={17} /> CLIENTES
          </p>
          <h2 className="text-2xl font-black text-[#142c4e] sm:text-3xl">
            Clientes registrados
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Consultá sus datos y administrá el acceso a la tienda.
          </p>
        </div>
        <div className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#142c4e] shadow-sm">
          {clientes.length} clientes
        </div>
      </header>

      <label className="relative block">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, correo o teléfono..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-[#10489f]"
        />
      </label>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} /> {error}
        </p>
      )}
      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <LoaderCircle className="animate-spin text-[#10489f]" size={28} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <UserRound className="mx-auto text-slate-300" size={36} />
          <p className="mt-3 font-bold text-[#142c4e]">No hay clientes para mostrar</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {filtrados.map((cliente) => (
              <article
                key={cliente.id}
                className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-[#10489f]">
                    {(cliente.nombre || cliente.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#142c4e]">
                      {cliente.nombre || "Sin nombre"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {cliente.email || "Sin correo"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {cliente.telefono || "Sin teléfono"}
                      {cliente.direccion ? ` · ${cliente.direccion}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      cliente.activo === false
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {cliente.activo === false ? "Deshabilitado" : "Activo"}
                  </span>
                  <button
                    type="button"
                    disabled={actualizando === cliente.id}
                    onClick={() => void cambiarEstado(cliente)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#142c4e] hover:bg-slate-50 disabled:opacity-50"
                  >
                    {actualizando === cliente.id
                      ? "Guardando..."
                      : cliente.activo === false
                        ? "Habilitar"
                        : "Deshabilitar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
