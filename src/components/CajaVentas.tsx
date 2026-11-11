
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  BrowserMultiFormatReader,
} from "@zxing/browser";

import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
  Banknote,
  CreditCard,
  ArrowLeftRight,
} from "lucide-react";

import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/config";
import { auth } from "../firebase/auth";

/* =========================
   TIPOS
========================= */

interface Producto {
  id: string;
  numeroProducto?: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  category?: string;
  image?: string;
  stock: number;
  active: boolean;
  identificador: string;
}

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

type MetodoPago = "efectivo" | "transferencia" | "tarjeta";

/* =========================
   FORMATO DE DINERO
========================= */

const formatoPrecio = (valor: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(valor);

/* =========================
   ESCÁNER DE CÓDIGO
========================= */

interface ScannerProps {
  onDetected: (codigo: string) => void;
  onClose: () => void;
}

function ScannerCaja({ onDetected, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [error, setError] = useState("");

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let activo = true;
    const video = videoRef.current;

    if (!video) return;

    const timeout = window.setTimeout(() => {
      if (activo && !video.videoWidth) {
        activo = false;
        controlsRef.current?.stop();
        setError(
          "La cámara no está enviando video. Cerrá otras aplicaciones que la estén usando y volvé a intentar."
        );
      }
    }, 8000);

    const iniciar = async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (resultado) => {
            if (!activo || !resultado) return;

            const codigo = resultado.getText();

            if (codigo) {
              activo = false;
              controlsRef.current?.stop();
              onDetectedRef.current(codigo);
            }
          }
        );

        if (activo) {
          controlsRef.current = controls;
        } else {
          controls.stop();
        }
      } catch (err) {
        console.error("Error al iniciar cámara:", err);

        if (activo) {
          const nombreError = err instanceof DOMException ? err.name : "";
          setError(
            nombreError === "NotAllowedError" ||
              nombreError === "SecurityError"
              ? "El navegador bloqueó la cámara. Revisá los permisos del sitio."
              : nombreError === "NotFoundError"
                ? "No se encontró una cámara disponible."
                : nombreError === "NotReadableError" ||
                    nombreError === "AbortError"
                  ? "La cámara está ocupada por otra aplicación. Cerrala y volvé a intentar."
                  : "No se pudo iniciar la cámara. Verificá los permisos y que el sitio use HTTPS."
          );
        }
      }
    };

    iniciar();

    return () => {
      activo = false;
      window.clearTimeout(timeout);
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-[#142c4e]">
            Escaneando producto
          </p>
          <p className="text-xs text-slate-500">
            Apuntá la cámara al código de barras.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white p-2 text-slate-500 hover:bg-slate-100"
        >
          <X size={18} />
        </button>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full object-cover"
            onPlaying={() => setError("")}
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-[85%] rounded-xl border-2 border-[#D5FF45]" />
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-slate-500">
        Mantené el código dentro del recuadro.
      </p>
    </div>
  );
}

/* =========================
   CAJA DE VENTAS
========================= */

export default function CajaVentas() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);

  const [codigoManual, setCodigoManual] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [escaneando, setEscaneando] = useState(false);

  const [metodoPago, setMetodoPago] =
    useState<MetodoPago>("efectivo");

  const [loadingProductos, setLoadingProductos] = useState(true);
  const [procesandoVenta, setProcesandoVenta] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  /* =========================
     CARGAR PRODUCTOS
  ========================= */

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Producto[];

        setProductos(lista.filter((producto) => producto.active !== false));
        setLoadingProductos(false);
      },
      (err) => {
        console.error("Error cargando productos:", err);
        setError("No se pudieron cargar los productos.");
        setLoadingProductos(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================
     AGREGAR PRODUCTO
  ========================= */

  const agregarProducto = useCallback(
    (codigo: string) => {
      const codigoLimpio = codigo.trim();

      if (!codigoLimpio) return;

      const producto = productos.find(
        (item) =>
          item.identificador === codigoLimpio ||
          item.numeroProducto === codigoLimpio
      );

      if (!producto) {
        setError(`No encontramos ningún producto con el código ${codigoLimpio}.`);
        setMensaje("");
        return;
      }

      setError("");
      setMensaje(`${producto.name} agregado a la venta.`);

      setCarrito((actual) => {
        const existente = actual.find(
          (item) => item.producto.id === producto.id
        );

        if (existente) {
          if (existente.cantidad >= producto.stock) {
            setError(`No hay más stock disponible de ${producto.name}.`);
            setMensaje("");
            return actual;
          }

          return actual.map((item) =>
            item.producto.id === producto.id
              ? { ...item, cantidad: item.cantidad + 1 }
              : item
          );
        }

        if (producto.stock <= 0) {
          setError(`${producto.name} no tiene stock disponible.`);
          setMensaje("");
          return actual;
        }

        return [...actual, { producto, cantidad: 1 }];
      });

      setCodigoManual("");
    },
    [productos]
  );

  const manejarCodigoEscaneado = useCallback(
  (codigo: string) => {
    setEscaneando(false);
    agregarProducto(codigo.replace(/\D/g, ""));
  },
  [agregarProducto]
);

  /* =========================
     BUSCAR CÓDIGO MANUAL
  ========================= */

 const buscarCodigo = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    agregarProducto(codigoManual);
  };

  /* =========================
     CANTIDADES DEL CARRITO
  ========================= */

  const cambiarCantidad = (productoId: string, cambio: number) => {
    setCarrito((actual) =>
      actual
        .map((item) => {
          if (item.producto.id !== productoId) return item;

          const nuevaCantidad = item.cantidad + cambio;

          if (nuevaCantidad <= 0) return item;

          if (nuevaCantidad > item.producto.stock) {
            setError(
              `Stock insuficiente de ${item.producto.name}. Disponible: ${item.producto.stock}.`
            );
            return item;
          }

          return { ...item, cantidad: nuevaCantidad };
        })
        .filter((item) => item.cantidad > 0)
    );

    setError("");
  };

  const eliminarProducto = (productoId: string) => {
    setCarrito((actual) =>
      actual.filter((item) => item.producto.id !== productoId)
    );
    setError("");
  };

  /* =========================
     TOTALES
  ========================= */

  const cantidadProductos = carrito.reduce(
    (total, item) => total + item.cantidad,
    0
  );

  const totalVenta = carrito.reduce(
    (total, item) =>
      total + Number(item.producto.price) * item.cantidad,
    0
  );

  /* =========================
     REGISTRAR VENTA
  ========================= */

  const confirmarVenta = async () => {
    if (carrito.length === 0) {
      setError("Agregá al menos un producto a la venta.");
      return;
    }

    if (!auth.currentUser) {
      setError("No se pudo identificar al usuario que realiza la venta.");
      return;
    }

    setProcesandoVenta(true);
    setError("");
    setMensaje("");

    try {
      const ventaRef = doc(collection(db, "ventas"));

      await runTransaction(db, async (transaction) => {
        // Primero leemos todos los productos para comprobar el stock.
        const referencias = carrito.map((item) =>
          doc(db, "productos", item.producto.id)
        );

        const documentos = await Promise.all(
          referencias.map((referencia) => transaction.get(referencia))
        );

        const itemsVenta = carrito.map((item, index) => {
          const documento = documentos[index];

          if (!documento.exists()) {
            throw new Error(
              `El producto ${item.producto.name} ya no existe.`
            );
          }

          const datos = documento.data();
          const stockActual = Number(datos.stock ?? 0);
          const precioActual = Number(datos.price ?? 0);

          if (datos.active === false) {
            throw new Error(
              `${item.producto.name} ya no está disponible.`
            );
          }

          if (stockActual < item.cantidad) {
            throw new Error(
              `Stock insuficiente de ${item.producto.name}. Disponible: ${stockActual}.`
            );
          }

          return {
            productoId: documento.id,
            numeroProducto: String(datos.numeroProducto ?? ""),
            identificador: String(datos.identificador ?? ""),
            nombre: String(datos.name ?? ""),
            precio: precioActual,
            cantidad: item.cantidad,
            subtotal: precioActual * item.cantidad,
            imagen: String(datos.image ?? ""),
          };
        });

        const totalFinal = itemsVenta.reduce(
          (total, item) => total + item.subtotal,
          0
        );

        // Descontamos el stock de cada producto.
        documentos.forEach((documento, index) => {
          const stockActual = Number(documento.data()?.stock ?? 0);

          transaction.update(referencias[index], {
            stock: stockActual - carrito[index].cantidad,
          });
        });

        // Guardamos la venta.
        transaction.set(ventaRef, {
          numero: ventaRef.id,
          items: itemsVenta,
          cantidadProductos: itemsVenta.reduce(
            (total, item) => total + item.cantidad,
            0
          ),
          subtotal: totalFinal,
          total: totalFinal,
          metodoPago,
          tipo: "mostrador",
          estado: "completada",
          usuarioUid: auth.currentUser!.uid,
          usuarioEmail: auth.currentUser!.email ?? "",
          creadoEn: serverTimestamp(),
        });
      });

      setCarrito([]);
      setCodigoManual("");
      setBusqueda("");
      setMetodoPago("efectivo");
      setEscaneando(false);
      setMensaje("¡Venta registrada correctamente!");
    } catch (err) {
      console.error("Error registrando venta:", err);

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar la venta."
      );
    } finally {
      setProcesandoVenta(false);
    }
  };

  /* =========================
     PRODUCTOS PARA MOSTRAR
  ========================= */

  const productosFiltrados = productos.filter((producto) => {
    const texto = busqueda.toLowerCase();

    return (
      producto.name.toLowerCase().includes(texto) ||
      String(producto.identificador ?? "").includes(texto) ||
      String(producto.numeroProducto ?? "").toLowerCase().includes(texto)
    );
  });

  /* =========================
     INTERFAZ
  ========================= */

  return (
    <div className="space-y-6">
      {/* ENCABEZADO */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#10489f]">
            PIPES / Administración
          </p>
          <h1 className="mt-1 text-2xl font-black text-[#142c4e] sm:text-3xl">
            Caja de ventas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Escaneá productos y registrá ventas del local.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-[#142c4e]">
          <ShoppingCart size={19} />
          {cantidadProductos} unidades
        </div>
      </div>

      {/* MENSAJES */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {mensaje && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {mensaje}
          <button
            type="button"
            onClick={() => setMensaje("")}
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_420px]">
        {/* COLUMNA IZQUIERDA */}
        <div className="space-y-5">
          {/* ESCANEAR */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-[#10489f]">
                <Barcode size={23} />
              </div>
              <div>
                <h2 className="font-black text-[#142c4e]">
                  Agregar productos
                </h2>
                <p className="text-xs text-slate-500">
                  Escaneá el código o ingresalo manualmente.
                </p>
              </div>
            </div>

            <form
              onSubmit={buscarCodigo}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <div className="relative flex-1">
                <Barcode
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(e.target.value)}
                  placeholder="Escaneá o ingresá el código..."
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-3.5 pl-11 pr-4 text-sm outline-none focus:border-[#10489f] focus:bg-white"
                />
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#142c4e] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#10489f]"
              >
                <Plus size={18} />
                Agregar
              </button>

              <button
                type="button"
                onClick={() => setEscaneando((prev) => !prev)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#142c4e] px-5 py-3.5 text-sm font-bold text-[#142c4e] hover:bg-blue-50"
              >
                <Camera size={18} />
                {escaneando ? "Cerrar cámara" : "Escanear"}
              </button>
            </form>

{escaneando && (
  <div className="mt-4">
    <ScannerCaja
      onDetected={manejarCodigoEscaneado}
      onClose={() => setEscaneando(false)}
    />
  </div>
)}

            <p className="mt-3 text-xs text-slate-400">
              También podés utilizar un lector físico USB: normalmente escribe el código en el campo y envía Enter.
            </p>
          </div>

          {/* BUSCADOR DE PRODUCTOS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-[#142c4e]">
                  Catálogo de productos
                </h2>
                <p className="text-xs text-slate-500">
                  Seleccioná un producto para agregarlo.
                </p>
              </div>

              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                {productos.length} productos
              </span>
            </div>

            <div className="relative mb-4">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-3 pl-11 pr-4 text-sm outline-none focus:border-[#10489f]"
              />
            </div>

            {loadingProductos ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#10489f]" size={28} />
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="py-10 text-center">
                <Package
                  size={35}
                  className="mx-auto mb-2 text-slate-300"
                />
                <p className="text-sm font-bold text-slate-500">
                  No encontramos productos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {productosFiltrados.map((producto) => (
                  <button
                    key={producto.id}
                    type="button"
                    onClick={() =>
                      agregarProducto(
                        producto.identificador || producto.numeroProducto || ""
                      )
                    }
                    disabled={producto.stock <= 0}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-[#10489f] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                      {producto.image ? (
                        <img
                          src={producto.image}
                          alt={producto.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Package className="text-slate-300" size={24} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-[#142c4e]">
                        {producto.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Código: {producto.identificador || "Sin código"}
                      </p>
                      {producto.numeroProducto && (
                        <p className="mt-1 text-xs text-slate-400">
                          N.º propio: {producto.numeroProducto}
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="font-black text-[#10489f]">
                          {formatoPrecio(Number(producto.price))}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Stock: {producto.stock}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: CARRITO */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
          <div className="flex items-center justify-between bg-[#142c4e] px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <ShoppingCart size={21} />
              <div>
                <h2 className="font-black">Venta actual</h2>
                <p className="text-xs text-blue-100">
                  {cantidadProductos} unidades
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCarrito([])}
              disabled={carrito.length === 0 || procesandoVenta}
              className="rounded-lg p-2 text-blue-100 hover:bg-white/10 disabled:opacity-40"
              title="Vaciar carrito"
            >
              <Trash2 size={18} />
            </button>
          </div>

          {/* ITEMS */}
          <div className="max-h-[420px] min-h-[180px] space-y-3 overflow-y-auto p-4">
            {carrito.length === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-full bg-slate-100 p-4">
                  <ShoppingCart size={27} className="text-slate-300" />
                </div>
                <p className="font-bold text-slate-500">
                  La venta está vacía
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Escaneá un producto para comenzar.
                </p>
              </div>
            ) : (
              carrito.map((item) => (
                <div
                  key={item.producto.id}
                  className="flex gap-3 border-b border-slate-100 pb-3 last:border-0"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                    {item.producto.image ? (
                      <img
                        src={item.producto.image}
                        alt={item.producto.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Package size={21} className="text-slate-300" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold text-[#142c4e]">
                      {item.producto.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatoPrecio(Number(item.producto.price))} c/u
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            cambiarCantidad(item.producto.id, -1)
                          }
                          className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-100"
                        >
                          <Minus size={13} />
                        </button>

                        <span className="min-w-5 text-center text-sm font-bold">
                          {item.cantidad}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            cambiarCantidad(item.producto.id, 1)
                          }
                          className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-100"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <span className="text-sm font-black text-[#142c4e]">
                        {formatoPrecio(
                          Number(item.producto.price) * item.cantidad
                        )}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => eliminarProducto(item.producto.id)}
                    className="self-start rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Quitar producto"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* PAGO Y TOTAL */}
          <div className="space-y-4 border-t border-slate-100 bg-[#F8FAFC] p-5">
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Medio de pago
              </p>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMetodoPago("efectivo")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                    metodoPago === "efectivo"
                      ? "border-[#10489f] bg-blue-50 text-[#10489f]"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <Banknote size={20} />
                  Efectivo
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPago("transferencia")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                    metodoPago === "transferencia"
                      ? "border-[#10489f] bg-blue-50 text-[#10489f]"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <ArrowLeftRight size={20} />
                  Transfer.
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPago("tarjeta")}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${
                    metodoPago === "tarjeta"
                      ? "border-[#10489f] bg-blue-50 text-[#10489f]"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <CreditCard size={20} />
                  Tarjeta
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-sm font-bold text-slate-500">
                Total a cobrar
              </span>
              <span className="text-2xl font-black text-[#142c4e]">
                {formatoPrecio(totalVenta)}
              </span>
            </div>

            <button
              type="button"
              onClick={confirmarVenta}
              disabled={carrito.length === 0 || procesandoVenta}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D5FF45] px-5 py-4 text-sm font-black text-[#142c4e] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {procesandoVenta ? (
                <>
                  <Loader2 size={19} className="animate-spin" />
                  Registrando venta...
                </>
              ) : (
                <>
                  <CheckCircle2 size={19} />
                  CONFIRMAR VENTA
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-slate-400">
              Al confirmar se registra la venta y se descuenta el stock.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
