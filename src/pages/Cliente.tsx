import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import { useNavigate } from "react-router-dom";
import {
  UserRound,
  Camera,
  ImagePlus,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Heart,
  Users,
  Wallet,
  Bell,
  ShieldCheck,
  Moon,
  Sun,
  LogOut,
  Ticket,
  Crown,
  CircleHelp,
  Phone,
  Package,
  ShoppingBag,
  CalendarDays,
  Check,
  X,
  LoaderCircle,
  Settings,
  Sparkles,
} from "lucide-react";

import Navbar from "../components/Navbar";
import { useNotifications } from "../components/useNotifications";
import { auth } from "../firebase/auth";
import { db } from "../firebase/config";

const storage = getStorage(auth.app);

type ProfileData = {
  nombre: string;
  telefono: string;
  direccion: string;
  fechaNacimiento: string;
  genero: string;
  fotoPerfil: string;
};

type PedidoCliente = {
  id: string;
  numero?: string;
  entrega?: {
    tipo?: "retiro" | "envio";
    direccion?: string;
  };
  notas?: string;
  items?: {
    productoId?: string;
    nombre?: string;
    imagen?: string;
    cantidad?: number;
    precio?: number;
    subtotal?: number;
  }[];
  total?: number;
  estado?: string;
  creadoEn?: { toDate?: () => Date };
  actualizadoEn?: { toDate?: () => Date };
};

const estadosPedido: Record<string, { titulo: string; color: string }> = {
  pendiente: {
    titulo: "Pendiente de confirmación",
    color: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  confirmado: {
    titulo: "Confirmado",
    color: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  cancelado: {
    titulo: "Cancelado",
    color: "bg-red-50 text-red-700 ring-red-200",
  },
  completado: {
    titulo: "Completado",
    color: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
};

const formatOrderPrice = (price: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price || 0);

const formatOrderDate = (timestamp?: PedidoCliente["creadoEn"]) =>
  timestamp?.toDate
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(timestamp.toDate())
    : "Fecha no disponible";

const initialProfile: ProfileData = {
  nombre: "",
  telefono: "",
  direccion: "",
  fechaNacimiento: "",
  genero: "",
  fotoPerfil: "",
};

type SectionProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onClick: () => void;
};

function AccordionSection({
  title,
  icon,
  children,
  open,
  onClick,
}: SectionProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#10489f]">
            {icon}
          </span>
          <span className="text-sm font-extrabold text-[#142C4E]">
            {title}
          </span>
        </span>

        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
          {children}
        </div>
      )}
    </section>
  );
}

type MenuItemProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onClick?: () => void;
};

function MenuItem({
  icon,
  title,
  description,
  onClick,
}: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="text-[#10489f]">{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-[#142C4E]">
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs text-slate-400">
              {description}
            </span>
          )}
        </span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-slate-400" />
    </button>
  );
}

export default function Cliente() {
  const navigate = useNavigate();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [orders, setOrders] = useState<PedidoCliente[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [activeQuickMenu, setActiveQuickMenu] = useState("");
  const [openSection, setOpenSection] = useState("");

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const cartCount = 0;
  const categories: { name: string; icon: string }[] = [];

  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { notify } = useNotifications();

  // Cargar sesión y datos del usuario
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setOrders([]);
        setOrdersError("");
        setOrdersLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      setOrders([]);
      setOrdersError("");
      setOrdersLoading(true);
      setUser(currentUser);

      try {
        const userRef = doc(db, "usuarios", currentUser.uid);
        const userDoc = await getDoc(userRef);

        const data = userDoc.exists() ? userDoc.data() : {};

        if (data.rol && !["cliente", "admin"].includes(data.rol)) {
          navigate("/", { replace: true });
          return;
        }

        setProfile({
          nombre:
            data.nombre ||
            currentUser.displayName ||
            currentUser.email?.split("@")[0] ||
            "",
          telefono: data.telefono || "",
          direccion: data.direccion || "",
          fechaNacimiento: data.fechaNacimiento || "",
          genero: data.genero || "",
          fotoPerfil: data.fotoPerfil || currentUser.photoURL || "",
        });
      } catch (err) {
        console.error("Error al cargar el perfil:", err);
        setError("No pudimos cargar todos tus datos.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const ordersQuery = query(
      collection(db, "pedidos"),
      where("cliente.uid", "==", user.uid)
    );
    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const customerOrders = snapshot.docs.map((orderDoc) => ({
          id: orderDoc.id,
          ...orderDoc.data(),
        })) as PedidoCliente[];
        customerOrders.sort(
          (a, b) =>
            (b.creadoEn?.toDate?.().getTime() ?? 0) -
            (a.creadoEn?.toDate?.().getTime() ?? 0)
        );
        setOrders(customerOrders);
        setOrdersError("");
        setOrdersLoading(false);
      },
      (snapshotError) => {
        console.error("Error al sincronizar los pedidos del perfil:", snapshotError);
        setOrdersError("No pudimos cargar tus pedidos. Intentá nuevamente.");
        setOrdersLoading(false);
        notify("error", "No pudimos sincronizar tus pedidos.");
      }
    );

    return unsubscribe;
  }, [notify, user]);

  const updateField = (field: keyof ProfileData, value: string) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // Guardar datos personales
  const saveProfile = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await setDoc(
        doc(db, "usuarios", user.uid),
        {
          nombre: profile.nombre.trim(),
          telefono: profile.telefono.trim(),
          direccion: profile.direccion.trim(),
          fechaNacimiento: profile.fechaNacimiento,
          genero: profile.genero,
          actualizadoEn: new Date(),
        },
        { merge: true }
      );

      notify("success", "Tus datos se guardaron correctamente.");
    } catch (err) {
      console.error("Error al guardar el perfil:", err);
      setError("No pudimos guardar tus datos. Intentá nuevamente.");
      notify("error", "No pudimos guardar tus datos. Intentá nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  // Subir foto de perfil a Firebase Storage
  const handlePhotoChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setError("Seleccioná un archivo de imagen válido.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar los 5 MB.");
      event.target.value = "";
      return;
    }

    try {
      setUploadingPhoto(true);
      setError("");
      setMessage("");

      const photoRef = ref(
        storage,
        `usuarios/${user.uid}/perfil`
      );

      await uploadBytes(photoRef, file);

      const photoURL = await getDownloadURL(photoRef);

      await setDoc(
        doc(db, "usuarios", user.uid),
        {
          fotoPerfil: photoURL,
          actualizadoEn: new Date(),
        },
        { merge: true }
      );

      setProfile((current) => ({
        ...current,
        fotoPerfil: photoURL,
      }));

      setMessage("Foto de perfil actualizada.");
      notify("success", "Foto de perfil actualizada.");
      setPhotoMenuOpen(false);
    } catch (err) {
      console.error("Error al subir la foto:", err);
      setError("No pudimos actualizar tu foto de perfil.");
      notify("error", "No pudimos actualizar tu foto de perfil.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  // Eliminar foto de perfil
  const removePhoto = async () => {
    if (!user) return;

    try {
      setUploadingPhoto(true);
      setError("");
      setMessage("");

      const photoRef = ref(
        storage,
        `usuarios/${user.uid}/perfil`
      );

      try {
        await deleteObject(photoRef);
      } catch (err) {
        console.warn("No se encontró una foto anterior:", err);
      }

      await setDoc(
        doc(db, "usuarios", user.uid),
        {
          fotoPerfil: "",
          actualizadoEn: new Date(),
        },
        { merge: true }
      );

      setProfile((current) => ({
        ...current,
        fotoPerfil: "",
      }));

      setMessage("Foto de perfil eliminada.");
      notify("success", "Foto de perfil eliminada.");
      setPhotoMenuOpen(false);
    } catch (err) {
      console.error("Error al eliminar la foto:", err);
      setError("No pudimos eliminar tu foto.");
      notify("error", "No pudimos eliminar tu foto.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      setError("No pudimos cerrar tu sesión.");
    }
  };

  // Progreso: 1. Teléfono, 2. Dirección, 3. Datos personales
  const completedItems = [
    Boolean(profile.telefono.trim()),
    Boolean(profile.direccion.trim()),
    Boolean(profile.fechaNacimiento && profile.genero),
  ];

  const completedCount = completedItems.filter(Boolean).length;
  const progress = (completedCount / 3) * 100;

  const quickMenus = [
    {
      id: "informacion",
      title: "Información personal",
      description: "Tus datos y preferencias",
      icon: <UserRound size={21} />,
      color: "bg-[#EAF2FF]",
    },
    {
      id: "cupones",
      title: "Cupones",
      description: "Tus descuentos",
      icon: <Ticket size={21} />,
      color: "bg-[#FFF1E7]",
    },
    {
      id: "plus",
      title: "PIPES Plus",
      description: "Conocé tus beneficios",
      icon: <Crown size={21} />,
      color: "bg-[#F4F0FF]",
    },
    {
      id: "ayuda",
      title: "Ayuda",
      description: "Estamos para ayudarte",
      icon: <CircleHelp size={21} />,
      color: "bg-[#E5F7F0]",
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F7FB]">
        <Navbar
          search={search}
          setSearch={setSearch}
          cartCount={cartCount}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          categories={categories}
        />
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />
          <div className="mt-5 h-28 animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-5 h-52 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen pb-12 transition-colors ${
        darkMode
          ? "bg-[#101827] text-white"
          : "bg-[#F5F7FB] text-[#142C4E]"
      }`}
    >
      <Navbar
        search={search}
        setSearch={setSearch}
        cartCount={cartCount}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        categories={categories}
      />

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-9">
        {/* Saludo y foto de perfil */}
        <section className="relative rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[1.8px] text-[#10489f]">
                Mi cuenta PIPES
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-[#142C4E] sm:text-3xl">
                ¡Hola, {profile.nombre || "Cliente"}! 👋
              </h1>

              <p className="mt-2 text-xs text-slate-500 sm:text-sm">
                Administrá tu cuenta y tus datos personales.
              </p>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPhotoMenuOpen(!photoMenuOpen)}
                className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-[#EAF2FF] bg-[#142C4E] shadow-md sm:h-24 sm:w-24"
                aria-label="Modificar foto de perfil"
              >
                {profile.fotoPerfil ? (
                  <img
                    src={profile.fotoPerfil}
                    alt="Foto de perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound size={38} className="text-white" />
                )}

                <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#D5FF45] text-[#142C4E]">
                  <Camera size={13} />
                </span>
              </button>

              {photoMenuOpen && (
                <div className="absolute right-0 top-28 z-30 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <p className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Foto de perfil
                  </p>

                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold text-[#142C4E] hover:bg-slate-50"
                  >
                    <Camera size={17} className="text-[#10489f]" />
                    Sacar una foto
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold text-[#142C4E] hover:bg-slate-50"
                  >
                    <ImagePlus size={17} className="text-[#10489f]" />
                    Elegir de galería
                  </button>

                  {profile.fotoPerfil && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      disabled={uploadingPhoto}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={17} />
                      Eliminar foto
                    </button>
                  )}
                </div>
              )}

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handlePhotoChange}
                className="hidden"
              />

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
          </div>

          {uploadingPhoto && (
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#10489f]">
              <LoaderCircle size={16} className="animate-spin" />
              Actualizando foto...
            </div>
          )}

          {profile.fotoPerfil && (
            <button
              type="button"
              onClick={() => setPhotoMenuOpen(!photoMenuOpen)}
              className="mt-4 text-[11px] font-bold text-[#10489f]"
            >
              Cambiar foto de perfil
            </button>
          )}
        </section>

        {/* Banner PIPES Plus */}
        <section className="relative mt-5 overflow-hidden rounded-3xl bg-[#142C4E] p-5 text-white shadow-sm sm:p-7">
          <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full border-[25px] border-white/[0.06]" />
          <div className="absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-[#10489f]/50 blur-2xl" />

          <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#D5FF45] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#142C4E]">
                <Sparkles size={13} />
                Beneficios exclusivos
              </span>

              <h2 className="mt-4 text-2xl font-black sm:text-3xl">
                ¡Probá PIPES Plus!
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/75">
                Disfrutá de envíos gratis durante todo el mes y descubrí
                todos los beneficios de ser parte de PIPES Plus.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveQuickMenu("plus")}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#D5FF45] px-5 py-3 text-xs font-black text-[#142C4E] transition hover:scale-[1.02]"
            >
              Conocer más
              <ChevronRight size={16} />
            </button>
          </div>
        </section>


        {/* Completar perfil */}
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#142C4E]">
                Completá tu perfil
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Completá tus datos para mejorar tu experiencia.
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-[#EAF2FF] px-3 py-1.5 text-xs font-black text-[#10489f]">
              {completedCount} de 3
            </span>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#10489f] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-xs">
              {completedItems[0] ? (
                <Check size={16} className="text-emerald-500" />
              ) : (
                <Phone size={16} className="text-slate-400" />
              )}
              <span className="font-semibold text-slate-600">
                Teléfono
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {completedItems[1] ? (
                <Check size={16} className="text-emerald-500" />
              ) : (
                <MapPin size={16} className="text-slate-400" />
              )}
              <span className="font-semibold text-slate-600">
                Dirección
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {completedItems[2] ? (
                <Check size={16} className="text-emerald-500" />
              ) : (
                <CalendarDays size={16} className="text-slate-400" />
              )}
              <span className="font-semibold text-slate-600">
                Datos personales
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveQuickMenu("informacion")}
            className="mt-5 text-xs font-extrabold text-[#10489f] hover:underline"
          >
            Completar mis datos <ChevronRight size={14} className="inline" />
          </button>
        </section>

                <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[1.5px] text-[#10489f]">
                Compras
              </p>
              <h2 className="mt-1 text-xl font-black text-[#142C4E]">
                Mis pedidos
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Consultá los productos y el estado actualizado de cada pedido.
              </p>
            </div>
            {!ordersLoading && (
              <span className="w-fit rounded-full bg-[#EAF2FF] px-3 py-1.5 text-xs font-black text-[#10489f]">
                {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
              </span>
            )}
          </div>

          {ordersLoading ? (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-8 text-sm font-semibold text-slate-500">
              <LoaderCircle size={18} className="animate-spin" />
              Sincronizando tus pedidos…
            </div>
          ) : ordersError ? (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {ordersError}
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <ShoppingBag size={30} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-bold text-[#142C4E]">
                Todavía no hiciste pedidos
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Cuando confirmes una compra, vas a poder seguirla desde acá.
              </p>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-4 rounded-lg bg-[#10489f] px-4 py-2.5 text-xs font-bold text-white"
              >
                Ver productos
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {orders.map((order) => {
                const status = estadosPedido[order.estado ?? ""] ?? {
                  titulo: order.estado || "Estado no disponible",
                  color: "bg-slate-100 text-slate-700 ring-slate-200",
                };
                const orderItems = order.items ?? [];

                return (
                  <article
                    key={order.id}
                    className="overflow-hidden rounded-2xl border border-slate-200"
                  >
                    <header className="flex flex-col gap-3 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black text-[#142C4E]">
                          Pedido #{order.numero || order.id}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {formatOrderDate(order.creadoEn)}
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full px-3 py-1.5 text-[11px] font-extrabold ring-1 ring-inset ${status.color}`}
                      >
                        {status.titulo}
                      </span>
                    </header>

                    <div className="space-y-3 p-4">
                      {orderItems.map((item, index) => (
                        <div
                          key={`${item.productoId || item.nombre || "producto"}-${index}`}
                          className="flex items-center gap-3"
                        >
                          {item.imagen ? (
                            <img
                              src={item.imagen}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg bg-slate-50 object-contain"
                            />
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#EAF2FF] text-[#10489f]">
                              <Package size={20} />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#142C4E]">
                              {item.nombre || "Producto"}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {item.cantidad ?? 0} × {formatOrderPrice(item.precio ?? 0)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-extrabold text-[#142C4E]">
                            {formatOrderPrice(
                              item.subtotal ??
                                (item.cantidad ?? 0) * (item.precio ?? 0)
                            )}
                          </p>
                        </div>
                      ))}
                    </div>

                    <footer className="border-t border-slate-100 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">
                          {order.entrega?.tipo === "envio"
                            ? `Envío · ${order.entrega.direccion || "Dirección no disponible"}`
                            : "Retiro en el local"}
                        </span>
                        <span className="font-black text-[#142C4E]">
                          Total: {formatOrderPrice(order.total ?? 0)}
                        </span>
                      </div>
                      {order.notas && (
                        <p className="mt-2 text-xs text-slate-500">
                          Nota: {order.notas}
                        </p>
                      )}
                      {order.actualizadoEn && (
                        <p className="mt-2 text-[10px] text-slate-400">
                          Estado actualizado: {formatOrderDate(order.actualizadoEn)}
                        </p>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Accesos rápidos */}
        <section className="mt-7">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[1.5px] text-[#10489f]">
              Tu cuenta
            </p>
            <h2 className="mt-1 text-lg font-black">Accesos rápidos</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickMenus.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setActiveQuickMenu(
                    activeQuickMenu === item.id ? "" : item.id
                  )
                }
                className={`rounded-2xl border p-4 text-left transition ${
                  activeQuickMenu === item.id
                    ? "border-[#10489f] bg-white shadow-md"
                    : "border-slate-200 bg-white hover:border-[#10489f]/40"
                }`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-[#10489f] ${item.color}`}
                >
                  {item.icon}
                </span>

                <span className="mt-3 block text-xs font-extrabold text-[#142C4E]">
                  {item.title}
                </span>

                <span className="mt-1 block text-[10px] text-slate-400">
                  {item.description}
                </span>
              </button>
            ))}
          </div>

          {/* Información personal */}
          {activeQuickMenu === "informacion" && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-[#142C4E]">
                    Información personal
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Actualizá los datos de tu cuenta.
                  </p>
                </div>
                <UserRound size={22} className="text-[#10489f]" />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold text-[#142C4E]">
                    Nombre completo
                  </label>
                  <input
                    value={profile.nombre}
                    onChange={(e) => updateField("nombre", e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#142C4E] outline-none transition focus:border-[#10489f]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-[#142C4E]">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={profile.telefono}
                    onChange={(e) => updateField("telefono", e.target.value)}
                    placeholder="Ej. 383 4000000"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#142C4E] outline-none transition focus:border-[#10489f]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-xs font-bold text-[#142C4E]">
                    Dirección principal
                  </label>
                  <input
                    value={profile.direccion}
                    onChange={(e) => updateField("direccion", e.target.value)}
                    placeholder="Calle, número, barrio..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#142C4E] outline-none transition focus:border-[#10489f]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-[#142C4E]">
                    Fecha de nacimiento
                  </label>
                  <input
                    type="date"
                    value={profile.fechaNacimiento}
                    onChange={(e) =>
                      updateField("fechaNacimiento", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-[#142C4E] outline-none focus:border-[#10489f]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-[#142C4E]">
                    Género
                  </label>
                  <select
                    value={profile.genero}
                    onChange={(e) => updateField("genero", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-[#142C4E] outline-none focus:border-[#10489f]"
                  >
                    <option value="">Seleccionar</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="no_binario">No binario</option>
                    <option value="prefiero_no_decirlo">
                      Prefiero no decirlo
                    </option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#10489f] px-4 py-3.5 text-xs font-extrabold text-white transition hover:bg-[#142C4E] disabled:opacity-50 sm:w-auto sm:min-w-48"
              >
                {saving ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          )}

          {/* Cupones */}
          {activeQuickMenu === "cupones" && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF1E7] text-orange-600">
                  <Ticket size={22} />
                </span>
                <div>
                  <h3 className="text-base font-black text-[#142C4E]">
                    Mis cupones
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Tus descuentos y promociones disponibles.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <Ticket size={28} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-bold text-[#142C4E]">
                  Todavía no tenés cupones
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Cuando tengas promociones disponibles, aparecerán acá.
                </p>
              </div>
            </div>
          )}

          {/* PIPES Plus */}
          {activeQuickMenu === "plus" && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4F0FF] text-violet-600">
                  <Crown size={22} />
                </span>
                <div>
                  <h3 className="text-base font-black text-[#142C4E]">
                    PIPES Plus
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Beneficios exclusivos para nuestros clientes.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-[#142C4E] p-5 text-white">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#D5FF45]">
                  Próximamente
                </p>
                <h4 className="mt-2 text-xl font-black">
                  Envíos gratis todo el mes
                </h4>
                <p className="mt-2 text-xs leading-5 text-white/70">
                  Estamos preparando los beneficios de PIPES Plus para que
                  disfrutes más de tus compras.
                </p>
              </div>
            </div>
          )}

          {/* Ayuda */}
          {activeQuickMenu === "ayuda" && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h3 className="text-base font-black text-[#142C4E]">
                ¿Necesitás ayuda?
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Si tenés alguna consulta sobre tu cuenta o tus pedidos,
                estamos para ayudarte.
              </p>

              <a
                href="https://wa.me/"
                target="_blank"
                rel="noreferrer"
                className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[#10489f] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#142C4E]"
              >
                <CircleHelp size={17} />
                Contactar soporte
              </a>

              <p className="mt-3 text-[10px] text-slate-400">
                Configurá el número de WhatsApp de PIPES en el enlace de
                soporte.
              </p>
            </div>
          )}
        </section>




        {/* Perfil */}
        <section className="mt-8">
          <p className="mb-3 px-1 text-[10px] font-black uppercase tracking-[1.5px] text-[#10489f]">
            Mi cuenta
          </p>

          <div className="space-y-3">
            <AccordionSection
              title="Perfil"
              icon={<UserRound size={20} />}
              open={openSection === "perfil"}
              onClick={() =>
                setOpenSection(openSection === "perfil" ? "" : "perfil")
              }
            >
              <div className="space-y-1">
                <MenuItem
                  icon={<MapPin size={18} />}
                  title="Direcciones"
                  description={profile.direccion || "Agregá tu dirección"}
                  onClick={() => {
                    setActiveQuickMenu("informacion");
                    setOpenSection("");
                  }}
                />

                <MenuItem
                  icon={<Heart size={18} />}
                  title="Favoritos"
                  description="Tus productos guardados"
                  onClick={() => {
                    setMessage("La sección de favoritos estará disponible próximamente.");
                  }}
                />

                <MenuItem
                  icon={<Users size={18} />}
                  title="Grupo familiar"
                  description="Compartí tu cuenta con tu familia"
                  onClick={() => {
                    setMessage("La sección de grupo familiar estará disponible próximamente.");
                  }}
                />
              </div>
            </AccordionSection>

            {/* Actividad */}
            <AccordionSection
              title="Actividad"
              icon={<Wallet size={20} />}
              open={openSection === "actividad"}
              onClick={() =>
                setOpenSection(
                  openSection === "actividad" ? "" : "actividad"
                )
              }
            >
              <MenuItem
                icon={<Wallet size={18} />}
                title="Billetera PIPES"
                description="Consultá tus movimientos y saldo"
                onClick={() => {
                  setMessage("La Billetera PIPES estará disponible próximamente.");
                }}
              />
            </AccordionSection>

            {/* Configuración */}
            <AccordionSection
              title="Configuración"
              icon={<Settings size={20} />}
              open={openSection === "configuracion"}
              onClick={() =>
                setOpenSection(
                  openSection === "configuracion" ? "" : "configuracion"
                )
              }
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-3">
                  <span className="flex items-center gap-3">
                    <Bell size={18} className="text-[#10489f]" />
                    <span>
                      <span className="block text-sm font-bold text-[#142C4E]">
                        Notificaciones
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        Recibí novedades y promociones
                      </span>
                    </span>
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications}
                    onClick={() => setNotifications(!notifications)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      notifications ? "bg-[#10489f]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                        notifications ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <MenuItem
                  icon={<ShieldCheck size={18} />}
                  title="Información legal"
                  description="Términos y condiciones y privacidad"
                  onClick={() => {
                    setMessage("La información legal estará disponible próximamente.");
                  }}
                />

                <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-3">
                  <span className="flex items-center gap-3">
                    {darkMode ? (
                      <Moon size={18} className="text-[#10489f]" />
                    ) : (
                      <Sun size={18} className="text-[#10489f]" />
                    )}
                    <span>
                      <span className="block text-sm font-bold text-[#142C4E]">
                        Modo {darkMode ? "noche" : "día"}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        Cambiar apariencia
                      </span>
                    </span>
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={darkMode}
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      darkMode ? "bg-[#10489f]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                        darkMode ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </AccordionSection>
          </div>
        </section>

        {/* Cerrar sesión */}
        <section className="mt-7">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-4 text-sm font-extrabold text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>

          <p className="mt-5 text-center text-[10px] text-slate-400">
            PIPES · Mercado &amp; Beer
          </p>
        </section>

        {/* Mensajes */}
        {(message || error) && (
          <div
            role="status"
            className={`fixed bottom-5 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs font-bold shadow-xl ${
              error
                ? "bg-red-600 text-white"
                : "bg-[#142C4E] text-white"
            }`}
          >
            <span>{error || message}</span>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setError("");
              }}
              aria-label="Cerrar mensaje"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}