import { useEffect, useState, type FormEvent } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { AlertCircle, LoaderCircle, Save, Settings } from "lucide-react";
import { db } from "../firebase/config";

type StoreSettings = {
  nombre: string;
  telefono: string;
  direccion: string;
  horario: string;
  mensajeTienda: string;
};

const INITIAL_SETTINGS: StoreSettings = {
  nombre: "PIPES",
  telefono: "",
  direccion: "",
  horario: "",
  mensajeTienda: "",
};

export default function ConfiguracionAdmin() {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "configuracion", "tienda"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setSettings({
            nombre: String(data.nombre ?? INITIAL_SETTINGS.nombre),
            telefono: String(data.telefono ?? ""),
            direccion: String(data.direccion ?? ""),
            horario: String(data.horario ?? ""),
            mensajeTienda: String(data.mensajeTienda ?? ""),
          });
        }
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error al cargar configuración:", snapshotError);
        setError("No se pudo cargar la configuración de la tienda.");
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await setDoc(
        doc(db, "configuracion", "tienda"),
        {
          nombre: settings.nombre.trim(),
          telefono: settings.telefono.trim(),
          direccion: settings.direccion.trim(),
          horario: settings.horario.trim(),
          mensajeTienda: settings.mensajeTienda.trim(),
          actualizadoEn: serverTimestamp(),
        },
        { merge: true }
      );
      setMessage("Configuración guardada correctamente.");
    } catch (saveError) {
      console.error("Error al guardar configuración:", saveError);
      setError("No se pudo guardar la configuración. Revisá las reglas de Firestore.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <LoaderCircle className="animate-spin text-[#10489f]" size={28} />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-[#10489f]">
          <Settings size={17} /> CONFIGURACIÓN
        </p>
        <h2 className="text-2xl font-black text-[#142c4e] sm:text-3xl">
          Datos de la tienda
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Actualizá la información de contacto y los datos operativos del comercio.
        </p>
      </header>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} /> {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
          {message}
        </p>
      )}

      <form onSubmit={guardar} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <label className="block text-sm font-bold text-[#142c4e]">
          Nombre del comercio *
          <input
            required
            maxLength={100}
            value={settings.nombre}
            onChange={(event) =>
              setSettings((current) => ({ ...current, nombre: event.target.value }))
            }
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#10489f]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#142c4e]">
            Teléfono de contacto
            <input
              maxLength={40}
              value={settings.telefono}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  telefono: event.target.value,
                }))
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#10489f]"
            />
          </label>
          <label className="block text-sm font-bold text-[#142c4e]">
            Horario de atención
            <input
              maxLength={120}
              value={settings.horario}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  horario: event.target.value,
                }))
              }
              placeholder="Ej.: Lunes a sábado, 9 a 20 h"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#10489f]"
            />
          </label>
        </div>

        <label className="block text-sm font-bold text-[#142c4e]">
          Dirección del local
          <input
            maxLength={200}
            value={settings.direccion}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                direccion: event.target.value,
              }))
            }
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#10489f]"
          />
        </label>

        <label className="block text-sm font-bold text-[#142c4e]">
          Mensaje para clientes
          <textarea
            maxLength={500}
            rows={4}
            value={settings.mensajeTienda}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                mensajeTienda: event.target.value,
              }))
            }
            className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#10489f]"
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#142c4e] px-5 py-3 text-sm font-bold text-white hover:bg-[#10489f] disabled:opacity-60"
        >
          {saving ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : (
            <Save size={17} />
          )}
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </section>
  );
}
