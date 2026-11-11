
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  Users,
  Tags,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  ArrowUpRight,
  Package,
  Clock3,
  CircleDollarSign,
  Store,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

import { auth } from "../firebase/auth";
import { db } from "../firebase/config";
import ProductosAdmin from "../components/ProductosAdmin";
import PedidosAdmin from "../components/PedidosAdmin";
import ClientesAdmin from "../components/ClientesAdmin";
import PromocionesAdmin from "../components/PromocionesAdmin";
import ConfiguracionAdmin from "../components/ConfiguracionAdmin";
import VentasAdmin from "../components/VentasAdmin";

type Section =
  | "dashboard"
  | "productos"
  | "pedidos"
  | "clientes"
  | "promociones"
  | "ventas"
  | "configuracion";

const navigation: {
  id: Section;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "pedidos", label: "Pedidos", icon: ClipboardList },
  { id: "productos", label: "Productos", icon: ShoppingBag },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "promociones", label: "Promociones", icon: Tags },
  { id: "ventas", label: "Ventas", icon: BarChart3 },
  { id: "configuracion", label: "Configuración", icon: Settings },
];

const sectionInfo: Record<
  Section,
  { title: string; description: string }
> = {
  dashboard: {
    title: "Resumen general",
    description: "Todo lo que sucede en tu negocio, en un solo lugar.",
  },
  pedidos: {
    title: "Pedidos",
    description: "Administrá y seguí los pedidos de tus clientes.",
  },
  productos: {
    title: "Productos",
    description: "Gestioná el catálogo, los precios y el stock.",
  },
  clientes: {
    title: "Clientes",
    description: "Consultá y administrá la información de tus clientes.",
  },
  promociones: {
    title: "Promociones",
    description: "Creá ofertas y promociones para tu negocio.",
  },
  ventas: {
    title: "Ventas",
    description: "Revisá el movimiento y el rendimiento de tu negocio.",
  },
  configuracion: {
    title: "Configuración",
    description: "Personalizá las opciones de administración de PIPES.",
  },
};

function AdminLoading() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-[3px] border-[#142c4e]/20 border-t-[#142c4e] rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500 mt-4">
          Verificando acceso...
        </p>
      </div>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminName, setAdminName] = useState("Administrador");
  const [activeSection, setActiveSection] =
    useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;

      if (!user) {
        setAuthorized(false);
        setLoading(false);
        navigate("/", { replace: true });
        return;
      }

      try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnapshot = await getDoc(userRef);

        if (!mounted) return;

        if (!userSnapshot.exists()) {
          setAuthorized(false);
          setLoading(false);
          navigate("/", { replace: true });
          return;
        }

        const userData = userSnapshot.data();

        if (userData.rol !== "admin" || userData.activo !== true) {
          setAuthorized(false);
          setLoading(false);
          navigate("/", { replace: true });
          return;
        }

        setCurrentUser(user);
        setAdminName(
          userData.nombre || user.displayName || "Administrador"
        );
        setAuthorized(true);
        setLoading(false);
      } catch (error) {
        console.error("Error verificando administrador:", error);

        if (!mounted) return;

        setAuthorized(false);
        setLoading(false);
        navigate("/", { replace: true });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const selectSection = (section: Section) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  if (loading) return <AdminLoading />;
  if (!authorized || !currentUser) return null;

  const currentSection = sectionInfo[activeSection];

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-900">
      {/* SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[#142c4e] text-white flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="h-[82px] px-6 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="text-[25px] font-black tracking-tight">
              PIPES<span className="text-[#d5ff45]">.</span>
            </div>
            <p className="text-[10px] text-white/50 tracking-[2px] uppercase">
              Panel de administración
            </p>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/70 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-4 pt-7 pb-3">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[1.8px] text-white/35">
            Menú principal
          </p>
        </div>

        <nav className="px-3 space-y-1 flex-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const selected = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => selectSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                  selected
                    ? "bg-[#d5ff45] text-[#142c4e] shadow-lg shadow-black/10"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={19} strokeWidth={2} />
                <span>{item.label}</span>

                {selected && (
                  <ChevronRight size={17} className="ml-auto" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={17} className="text-[#d5ff45]" />
              <span className="text-xs font-semibold text-white">
                Acceso administrador
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-white/45">
              Tu cuenta tiene permisos para administrar PIPES.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <button
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* MAIN */}
      <div className="lg:ml-[260px] min-h-screen">
        {/* TOPBAR */}
        <header className="h-[82px] bg-white border-b border-slate-200/80 px-5 md:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>

            <div>
              <p className="text-xs text-slate-400 hidden sm:block">
                PIPES / Administración
              </p>
              <h1 className="text-lg font-bold text-[#142c4e]">
                {currentSection.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            <div className="hidden md:flex items-center gap-2 bg-[#f5f7fa] rounded-xl px-3 py-2.5 w-[220px]">
              <Search size={17} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
              />
            </div>

            <button
              className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-500"
              aria-label="Notificaciones"
              title="Notificaciones"
            >
              <Bell size={19} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#d5ff45] rounded-full border-2 border-white" />
            </button>

            <div className="h-9 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/cliente")}
                className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-bold text-[#142c4e] hover:bg-slate-50 sm:rounded-xl sm:px-3 sm:text-xs"
              >
                Mi perfil
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-bold text-[#142c4e] hover:bg-slate-50 sm:rounded-xl sm:px-3 sm:text-xs"
              >
                Ver tienda
              </button>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-800 max-w-[130px] truncate">
                  {adminName}
                </p>
                <p className="text-[11px] text-slate-400">
                  Administrador
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-[#142c4e] text-[#d5ff45] flex items-center justify-center font-bold">
                {adminName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="p-5 md:p-8 max-w-[1600px] mx-auto">
          <div className="mb-7">
            <p className="text-sm text-slate-500">
              {currentSection.description}
            </p>
          </div>

{activeSection === "dashboard" ? (
  <DashboardOverview
    adminName={adminName}
    onNavigate={selectSection}
  />
) : activeSection === "productos" ? (
  <ProductosAdmin />
) : activeSection === "ventas" ? (
  <VentasAdmin />
) : activeSection === "pedidos" ? (
  <PedidosAdmin />
) : activeSection === "clientes" ? (
  <ClientesAdmin />
) : activeSection === "promociones" ? (
  <PromocionesAdmin />
) : activeSection === "configuracion" ? (
  <ConfiguracionAdmin />
) : (
  <DashboardOverview
    adminName={adminName}
    onNavigate={selectSection}
  />
)}
        </main>
      </div>
    </div>
  );
}

function DashboardOverview({
  adminName,
  onNavigate,
}: {
  adminName: string;
  onNavigate: (section: Section) => void;
}) {
  const [statsData, setStatsData] = useState({
    pedidosHoy: 0,
    ventasHoy: 0,
    ingresosHoy: 0,
    productos: 0,
    clientes: 0,
  });
  const [activity, setActivity] = useState<
    { id: string; label: string; detail: string; time: number }[]
  >([]);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    const hoy = () => {
      const current = new Date();
      return (date: Date) =>
        date.getFullYear() === current.getFullYear() &&
        date.getMonth() === current.getMonth() &&
        date.getDate() === current.getDate();
    };
    const errors: string[] = [];
    const handleError = (name: string) => (error: Error) => {
      console.error(`Error al cargar ${name} del dashboard:`, error);
      errors.push(name);
      setDashboardError(`No se pudieron cargar: ${errors.join(", ")}.`);
    };

    const unsubscribeProducts = onSnapshot(
      collection(db, "productos"),
      (snapshot) =>
        setStatsData((current) => ({ ...current, productos: snapshot.size })),
      handleError("productos")
    );
    const unsubscribeUsers = onSnapshot(
      collection(db, "usuarios"),
      (snapshot) =>
        setStatsData((current) => ({
          ...current,
          clientes: snapshot.docs.filter(
            (item) => item.data().rol === "cliente"
          ).length,
        })),
      handleError("clientes")
    );
    const unsubscribeOrders = onSnapshot(
      collection(db, "pedidos"),
      (snapshot) => {
        const orders = snapshot.docs.map((item) => ({
          id: item.id,
          data: item.data(),
        }));
        const isToday = hoy();
        const todayOrders = orders.filter(({ data }) => {
          const date = data.creadoEn?.toDate?.();
          return date instanceof Date && isToday(date);
        });
        setStatsData((current) => ({
          ...current,
          pedidosHoy: todayOrders.length,
        }));
        setActivity((current) => {
          const sales = current.filter((item) => !item.id.startsWith("pedido:"));
          const newOrders = orders.map(({ id, data }) => {
            const date = data.creadoEn?.toDate?.();
            return {
              id: `pedido:${id}`,
              label: `Pedido ${String(data.numero ?? id).slice(0, 8)}`,
              detail: `${String(data.cliente?.nombre ?? "Cliente")} · ${String(data.estado ?? "pendiente")}`,
              time: date instanceof Date ? date.getTime() : 0,
            };
          });
          return [...sales, ...newOrders]
            .sort((a, b) => b.time - a.time)
            .slice(0, 5);
        });
      },
      handleError("pedidos")
    );
    const unsubscribeSales = onSnapshot(
      collection(db, "ventas"),
      (snapshot) => {
        const sales = snapshot.docs.map((item) => ({
          id: item.id,
          data: item.data(),
        }));
        const isToday = hoy();
        const todaySales = sales.filter(({ data }) => {
          const date = data.creadoEn?.toDate?.();
          return date instanceof Date && isToday(date);
        });
        setStatsData((current) => ({
          ...current,
          ventasHoy: todaySales.length,
          ingresosHoy: todaySales.reduce(
            (sum, item) => sum + Number(item.data.total ?? 0),
            0
          ),
        }));
        setActivity((current) => {
          const orders = current.filter((item) => item.id.startsWith("pedido:"));
          const newSales = sales.map(({ id, data }) => {
            const date = data.creadoEn?.toDate?.();
            return {
              id: `venta:${id}`,
              label: `Venta ${String(data.numero ?? id).slice(0, 8)}`,
              detail: `${Number(data.cantidadProductos ?? 0)} productos · $${Number(data.total ?? 0).toLocaleString("es-AR")}`,
              time: date instanceof Date ? date.getTime() : 0,
            };
          });
          return [...orders, ...newSales]
            .sort((a, b) => b.time - a.time)
            .slice(0, 5);
        });
      },
      handleError("ventas")
    );

    return () => {
      unsubscribeProducts();
      unsubscribeUsers();
      unsubscribeOrders();
      unsubscribeSales();
    };
  }, []);

  const stats = [
    {
      label: "Pedidos de hoy",
      value: String(statsData.pedidosHoy),
      detail: "Pedidos recibidos hoy",
      icon: ClipboardList,
    },
    {
      label: "Ventas del día",
      value: statsData.ingresosHoy.toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }),
      detail: `${statsData.ventasHoy} ventas registradas`,
      icon: CircleDollarSign,
    },
    {
      label: "Productos",
      value: String(statsData.productos),
      detail: "Productos del catálogo",
      icon: Package,
    },
    {
      label: "Clientes registrados",
      value: String(statsData.clientes),
      detail: "Cuentas de cliente",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-7">
      {dashboardError && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          <Clock3 size={17} /> {dashboardError}
        </p>
      )}
      {/* WELCOME */}
      <section className="relative overflow-hidden rounded-3xl bg-[#142c4e] p-6 md:p-9 text-white">
        <div className="absolute -right-16 -top-28 w-80 h-80 rounded-full border-[45px] border-white/[0.04]" />
        <div className="absolute right-24 -bottom-36 w-72 h-72 rounded-full bg-[#d5ff45]/[0.08] blur-2xl" />

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#d5ff45] mb-5">
            <Store size={13} />
            PANEL DE CONTROL
          </div>

          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            ¡Hola, {adminName}!
          </h2>

          <p className="text-sm md:text-base text-white/60 mt-3 leading-relaxed max-w-lg">
            Bienvenido al centro de administración de PIPES.
            Desde acá vas a poder gestionar tu negocio y controlar
            toda la operación.
          </p>

          <button
            onClick={() => onNavigate("pedidos")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#d5ff45] text-[#142c4e] px-5 py-3 text-sm font-bold hover:bg-[#e2ff7d] transition"
          >
            Ir a pedidos
            <ArrowUpRight size={17} />
          </button>
        </div>
      </section>

      {/* STATS */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">
              Indicadores del negocio
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Resumen de actividad
            </p>
          </div>
          <span className="text-[11px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-400">
            Actualizado en tiempo real
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#142c4e]/[0.06] text-[#142c4e] flex items-center justify-center">
                    <Icon size={19} />
                  </div>
                  <span className="text-xs text-slate-300">—</span>
                </div>

                <p className="text-sm text-slate-500 mt-5">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-[#142c4e] mt-1">
                  {stat.value}
                </p>
                <p className="text-[11px] text-slate-400 mt-2">
                  {stat.detail}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* MANAGEMENT */}
      <section>
        <div className="mb-4">
          <h3 className="font-bold text-slate-800">
            Administración
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Accesos directos a las herramientas del negocio
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            {
              title: "Gestionar pedidos",
              description: "Revisá los pedidos y sus estados.",
              icon: ClipboardList,
              section: "pedidos" as Section,
            },
            {
              title: "Catálogo de productos",
              description: "Administrá productos, precios y stock.",
              icon: ShoppingBag,
              section: "productos" as Section,
            },
            {
              title: "Clientes",
              description: "Consultá la información de tus clientes.",
              icon: Users,
              section: "clientes" as Section,
            },
            {
              title: "Promociones",
              description: "Administrá descuentos y ofertas.",
              icon: Tags,
              section: "promociones" as Section,
            },
            {
              title: "Ventas",
              description: "Consultá el movimiento comercial.",
              icon: BarChart3,
              section: "ventas" as Section,
            },
            {
              title: "Configuración",
              description: "Configurá las opciones del negocio.",
              icon: Settings,
              section: "configuracion" as Section,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.section}
                onClick={() => onNavigate(item.section)}
                className="group bg-white border border-slate-200/80 rounded-2xl p-5 text-left hover:border-[#142c4e]/30 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-[#142c4e]/[0.06] text-[#142c4e] flex items-center justify-center group-hover:bg-[#d5ff45] transition">
                    <Icon size={21} />
                  </div>
                  <ArrowUpRight
                    size={18}
                    className="text-slate-300 group-hover:text-[#142c4e] transition"
                  />
                </div>

                <h4 className="font-bold text-slate-800 mt-5">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ACTIVITY EMPTY STATE */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#142c4e]/[0.06] text-[#142c4e] flex items-center justify-center">
            <Clock3 size={19} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">
              Actividad reciente
            </h3>
            <p className="text-xs text-slate-400">
              Últimos movimientos del negocio
            </p>
          </div>
        </div>

        {activity.length ? (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {activity.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                </div>
                <p className="shrink-0 text-xs text-slate-400">
                  {item.time
                    ? new Intl.DateTimeFormat("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(item.time)
                    : "Reciente"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-9 text-center border-t border-slate-100">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
              <ClipboardList size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-600 mt-3">
              Todavía no hay actividad para mostrar
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Los pedidos y ventas aparecerán aquí en tiempo real.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
