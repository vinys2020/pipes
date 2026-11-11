
import { useEffect, useRef, useState } from "react";

import {
  ChevronRight,
  Home,
  MapPin,
  Percent,
  Search,
  ShoppingBag,
  ShoppingBasket,
  ClipboardList,
  UserRound,
  LogOut,
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth } from "../firebase/auth";
import { db } from "../firebase/config";
import { DEFAULT_CATEGORIES } from "../lib/storefront";

type NavbarCategory = {
  name: string;
  icon: string;
};

type NavbarProps = {
  search: string;
  setSearch: (value: string) => void;
  cartCount: number;
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  categories: NavbarCategory[];
  mobileOnly?: boolean;
  onCartClick?: () => void;
};

export default function Navbar({
  search,
  setSearch,
  cartCount,
  activeCategory,
  setActiveCategory,
  categories,
  mobileOnly = false,
  onCartClick,
}: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [desktopNavbarHidden, setDesktopNavbarHidden] = useState(false);
  const lastScrollY = useRef(0);
  const [storeLocation, setStoreLocation] = useState({
    name: "PIPES",
    address: "",
    status: "loading" as "loading" | "ready" | "missing" | "error",
  });
  const isAdmin = Boolean(user && adminUid === user.uid);

  useEffect(() => {
    const updateNavbarVisibility = () => {
      const currentScrollY = window.scrollY;

      if (window.innerWidth < 768 || currentScrollY <= 34) {
        setDesktopNavbarHidden(false);
        lastScrollY.current = currentScrollY;
        return;
      }

      const scrollDelta = currentScrollY - lastScrollY.current;
      if (Math.abs(scrollDelta) >= 28) {
        setDesktopNavbarHidden(scrollDelta > 0);
        lastScrollY.current = currentScrollY;
      }
    };

    lastScrollY.current = window.scrollY;
    window.addEventListener("scroll", updateNavbarVisibility, {
      passive: true,
    });
    window.addEventListener("resize", updateNavbarVisibility);

    return () => {
      window.removeEventListener("scroll", updateNavbarVisibility);
      window.removeEventListener("resize", updateNavbarVisibility);
    };
  }, []);

  useEffect(() => {
    return onSnapshot(
      doc(db, "configuracion", "tienda"),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setStoreLocation({
          name: String(data.nombre ?? "PIPES").trim() || "PIPES",
          address: String(data.direccion ?? "").trim(),
          status: String(data.direccion ?? "").trim() ? "ready" : "missing",
        });
      },
      (error) => {
        console.error("No se pudo cargar la ubicación de la tienda:", error);
        setStoreLocation({
          name: "PIPES",
          address: "",
          status: "error",
        });
      }
    );
  }, []);

  // Detectar sesión de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) setAdminUid(null);
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      doc(db, "usuarios", user.uid),
      (snapshot) => {
        setAdminUid(
          snapshot.exists() &&
            snapshot.data().rol === "admin" &&
            snapshot.data().activo === true
            ? user.uid
            : null
        );
      },
      (error) => {
        console.error("No se pudo verificar el rol de navegación:", error);
        setAdminUid(null);
      }
    );
  }, [user]);

  const scrollTo = (id: string) => {
    if (location.pathname !== "/") {
      navigate("/", {
        state: { scrollTo: id },
      });
      return;
    }

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const goToMarket = () => {
    setActiveCategory("Todos");
    navigate("/mercado");
  };

  const goToPromotions = () => {
    navigate("/promos");
  };

  const goToOrders = () => {
    if (user) {
      navigate("/pedidos");
    } else {
      navigate("/login");
    }
  };

  const goToProfile = () => {
    if (user) {
      navigate("/cliente");
    } else {
      navigate("/login");
    }

    setShowProfileMenu(false);
  };

  const goToAdmin = () => {
    navigate("/admin");
    setShowProfileMenu(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowProfileMenu(false);
      navigate("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const getUserName = () => {
    return (
      user?.displayName ||
      user?.email?.split("@")[0] ||
      "Mi cuenta"
    );
  };

  const getInitial = () => {
    return getUserName().charAt(0).toUpperCase();
  };

  const desktopCategories = [
    ...DEFAULT_CATEGORIES.map((name) => ({ name, icon: "" })),
    ...categories,
  ].filter(
    (category, index, list) =>
      list.findIndex(
        (item) =>
          item.name.trim().toLocaleLowerCase("es") ===
          category.name.trim().toLocaleLowerCase("es")
      ) === index
  );

  return (
    <>
      {/* BARRA DE NAVEGACIÓN SUPERIOR */}
      <header
        inert={desktopNavbarHidden}
        className={`${mobileOnly ? "hidden" : ""} sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-[0_4px_20px_rgba(20,44,78,.04)] backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          desktopNavbarHidden
            ? "md:pointer-events-none md:-translate-y-full"
            : "md:translate-y-0"
        }`}
      >
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6 lg:gap-7 lg:px-10">

          {/* Logo */}
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              scrollTo("inicio");
            }}
            className="flex shrink-0 items-center"
            aria-label="PIPES, ir al inicio"
          >
            <img
              src="/logonav.png"
              alt="PIPES — Súper almacén"
              className="h-10 w-24 object-contain sm:h-12 sm:w-32"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />

            <span className="hidden text-xl font-black tracking-tight text-[#142C4E]">
              PIPES<span className="text-[#10489f]">.</span>
            </span>
          </a>

          {/* Ubicación configurada por el comercio */}
          <a
            href={
              storeLocation.address
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeLocation.address)}`
                : undefined
            }
            target={storeLocation.address ? "_blank" : undefined}
            rel={storeLocation.address ? "noreferrer" : undefined}
            aria-label={
              storeLocation.address
                ? `${storeLocation.name}: ${storeLocation.address}. Abrir en Google Maps`
                : "La dirección de la tienda todavía no está configurada"
            }
            className={`hidden min-w-[170px] max-w-[280px] items-center gap-2 rounded-xl bg-[#F5F7FA] px-3 py-2.5 transition lg:flex ${
              storeLocation.address
                ? "hover:bg-[#EAF2FF]"
                : "cursor-default"
            }`}
          >
            <MapPin size={18} className="shrink-0 text-[#10489f]" />
            <span className="min-w-0 text-left">
              <span className="block text-[9px] font-medium text-slate-500">
                {storeLocation.name}
              </span>
              <span
                title={storeLocation.address || undefined}
                className="block whitespace-normal break-words text-xs font-bold leading-4 text-[#142C4E]"
              >
                {storeLocation.status === "loading"
                  ? "Cargando dirección…"
                  : storeLocation.status === "error"
                    ? "No se pudo cargar la dirección"
                    : storeLocation.address || "Dirección no configurada"}
              </span>
            </span>
            {storeLocation.address && (
              <ChevronRight size={14} className="ml-auto shrink-0 text-slate-400" />
            )}
          </a>

          {/* Buscador */}
          <form
            className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-[#F8FAFC] p-1 transition focus-within:border-[#10489f] focus-within:bg-white"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(
                `/mercado${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`
              );
            }}
          >
            <Search
              size={18}
              className="ml-2 shrink-0 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Buscar productos..."
              aria-label="Buscar productos"
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-xs outline-none placeholder:text-slate-400 sm:text-sm"
            />

            <button
              type="submit"
              className="hidden rounded-lg bg-[#10489f] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#142C4E] sm:block"
            >
              Buscar
            </button>
          </form>

          {/* Carrito: escritorio */}
          <button
            type="button"
            onClick={onCartClick ?? goToMarket}
            className="relative hidden h-11 shrink-0 items-center gap-2 rounded-xl bg-[#D5FF45] px-4 text-xs font-extrabold text-[#142C4E] transition hover:brightness-95 sm:flex"
          >
            <ShoppingBag size={18} />

            <span>Mi compra</span>

            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#142C4E] px-1 text-[10px] font-bold text-white">
              {cartCount}
            </span>
          </button>

          {/* PERFIL / INICIO DE SESIÓN: ESCRITORIO */}
          {user ? (
            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 transition hover:border-[#10489f] hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#142C4E] text-sm font-bold text-white">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Perfil"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitial()
                  )}
                </div>

                <div className="max-w-[120px] text-left">
                  <p className="text-[9px] text-slate-400">
                    Mi cuenta
                  </p>
                  <p className="truncate text-xs font-bold text-[#142C4E]">
                    {getUserName()}
                  </p>
                </div>

                <ChevronRight
                  size={15}
                  className={`text-slate-400 transition ${
                    showProfileMenu ? "rotate-90" : ""
                  }`}
                />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-[#142C4E]">
                      {getUserName()}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={goToProfile}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <UserRound size={17} />
                    Mi perfil
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={goToAdmin}
                      className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-[#10489f] transition hover:bg-blue-50"
                    >
                      <ClipboardList size={17} />
                      Panel administrador
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut size={17} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="hidden shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-[#142C4E] transition hover:border-[#10489f] hover:text-[#10489f] lg:flex"
            >
              <UserRound size={17} />
              Iniciar sesión
            </button>
          )}
        </div>

        {/* Navegación principal y categorías: escritorio */}
        <nav
          aria-label="Navegación principal de escritorio"
          className="hidden border-t border-slate-100 md:block"
        >
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3 text-xs font-semibold text-slate-600 lg:gap-x-6 lg:px-10">
            <button
              type="button"
              onClick={goToMarket}
              aria-current={location.pathname === "/mercado" ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap transition hover:text-[#10489f] ${
                location.pathname === "/mercado" ? "font-extrabold text-[#10489f]" : ""
              }`}
            >
              <ShoppingBasket size={15} />
              Mercado
            </button>
            <button
              type="button"
              onClick={goToPromotions}
              aria-current={location.pathname === "/promos" ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap transition hover:text-[#10489f] ${
                location.pathname === "/promos" ? "font-extrabold text-[#10489f]" : ""
              }`}
            >
              <Percent size={15} />
              Promociones
            </button>
            <button
              type="button"
              onClick={goToOrders}
              aria-current={location.pathname === "/pedidos" ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap transition hover:text-[#10489f] ${
                location.pathname === "/pedidos" ? "font-extrabold text-[#10489f]" : ""
              }`}
            >
              <ClipboardList size={15} />
              Pedidos
            </button>


            {desktopCategories.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => {
                  setActiveCategory(category.name);
                  navigate(
                    `/mercado?categoria=${encodeURIComponent(category.name)}`
                  );
                }}
                className={`whitespace-nowrap px-1 py-1.5 text-[11px] transition hover:border-[#10489f] hover:bg-[#EAF2FF] hover:text-[#10489f] ${
                  activeCategory.toLocaleLowerCase("es") ===
                  category.name.toLocaleLowerCase("es")
                    ? "border-[#10489f] bg-[#EAF2FF] font-extrabold text-[#10489f]"
                    : "border-slate-200 bg-white"
                }`}
              >
                {category.name}
              </button>
            ))}


          </div>
        </nav>
      </header>

      {/* NAVEGACIÓN INFERIOR: CELULARES */}
      <nav
        aria-label="Navegación principal móvil"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(20,44,78,.08)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">

          {/* Inicio */}
          <button
            type="button"
            onClick={() => scrollTo("inicio")}
            className="flex min-h-[66px] flex-col items-center justify-center gap-1 text-[#10489f] transition active:scale-95"
          >
            <Home size={22} strokeWidth={2.3} />
            <span className="text-[10px] font-bold">
              Inicio
            </span>
          </button>

          {/* Mercado */}
          <button
            type="button"
            onClick={goToMarket}
            className="flex min-h-[66px] flex-col items-center justify-center gap-1 text-slate-500 transition hover:text-[#10489f] active:scale-95"
          >
            <ShoppingBasket size={22} strokeWidth={2} />
            <span className="text-[10px] font-semibold">
              Mercado
            </span>
          </button>

          {/* Promociones */}
          <button
            type="button"
            onClick={goToPromotions}
            className="flex min-h-[66px] flex-col items-center justify-center gap-1 text-slate-500 transition hover:text-[#10489f] active:scale-95"
          >
            <Percent size={22} strokeWidth={2.2} />
            <span className="text-[10px] font-semibold">
              Promos
            </span>
          </button>

          {/* Carrito o pedidos */}
          <button
            type="button"
            onClick={goToOrders}
            className="relative flex min-h-[66px] flex-col items-center justify-center gap-1 text-slate-500 transition hover:text-[#10489f] active:scale-95"
          >
            <ClipboardList size={22} strokeWidth={2} />

            <span className="text-[10px] font-semibold">
              Pedidos
            </span>

            {cartCount > 0 && (
              <span className="absolute right-[calc(50%-19px)] top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#10489f] px-1 text-[9px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>

          {/* Perfil / inicio de sesión */}
          <button
            type="button"
            onClick={() =>
              user ? setShowProfileMenu((current) => !current) : goToProfile()
            }
            aria-expanded={user ? showProfileMenu : undefined}
            aria-haspopup={user ? "menu" : undefined}
            className={`flex min-h-[66px] flex-col items-center justify-center gap-1 transition active:scale-95 ${
              showProfileMenu ? "text-[#10489f]" : "text-slate-500 hover:text-[#10489f]"
            }`}
          >
            {user ? (
              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#142C4E] text-xs font-bold text-white">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitial()
                )}
              </div>
            ) : (
              <UserRound size={22} strokeWidth={2} />
            )}

            <span className="max-w-[65px] truncate text-[10px] font-semibold">
              {user ? getUserName() : "Mi perfil"}
            </span>
          </button>
        </div>

        {user && showProfileMenu && (
          <div
            role="menu"
            aria-label="Opciones de cuenta"
            className="absolute bottom-full left-1/2 mb-2 w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_12px_40px_rgba(20,44,78,.18)]"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-[#142C4E]">
                {getUserName()}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={goToProfile}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <UserRound size={17} />
              Mi perfil
            </button>

            {isAdmin && (
              <button
                type="button"
                role="menuitem"
                onClick={goToAdmin}
                className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-[#10489f] transition hover:bg-blue-50"
              >
                <ClipboardList size={17} />
                Panel administrador
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={17} />
              Cerrar sesión
            </button>
          </div>
        )}
      </nav>
    </>
  );
}
