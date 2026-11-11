
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";
import {
  Search,
  Plus,
  Package,
  Pencil,
  Trash2,
  X,
  ImagePlus,
  Tag,
  Boxes,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Download,
} from "lucide-react";

import { db } from "../firebase/config";
import { useNotifications } from "./useNotifications";
import { DEFAULT_CATEGORIES } from "../lib/storefront";

import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera } from "lucide-react";

const storage = getStorage();

const CATEGORIAS = DEFAULT_CATEGORIES;

type ImportCell = string | number | boolean | Date | null;

const normalizarEncabezado = (valor: unknown) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const parsearCsv = (contenido: string): ImportCell[][] => {
  const texto = contenido.replace(/^\uFEFF/, "");
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? "";
  const contarSeparador = (separador: string) => {
    let entreComillas = false;
    let total = 0;

    for (let i = 0; i < primeraLinea.length; i += 1) {
      if (primeraLinea[i] === '"') {
        if (entreComillas && primeraLinea[i + 1] === '"') {
          i += 1;
        } else {
          entreComillas = !entreComillas;
        }
      } else if (!entreComillas && primeraLinea[i] === separador) {
        total += 1;
      }
    }

    return total;
  };
  const separador =
    contarSeparador(";") > contarSeparador(",") ? ";" : ",";
  const filas: ImportCell[][] = [];
  let fila: ImportCell[] = [];
  let celda = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i];

    if (caracter === '"') {
      if (entreComillas && texto[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (!entreComillas && caracter === separador) {
      fila.push(celda.trim());
      celda = "";
    } else if (!entreComillas && (caracter === "\n" || caracter === "\r")) {
      if (caracter === "\r" && texto[i + 1] === "\n") i += 1;
      fila.push(celda.trim());
      if (fila.some((valor) => valor !== "")) filas.push(fila);
      fila = [];
      celda = "";
    } else {
      celda += caracter;
    }
  }

  fila.push(celda.trim());
  if (fila.some((valor) => valor !== "")) filas.push(fila);
  return filas;
};

const leerPlanilla = async (archivo: File): Promise<ImportCell[][]> => {
  if (archivo.name.toLowerCase().endsWith(".csv")) {
    return parsearCsv(await archivo.text());
  }

  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const hojas = await readXlsxFile(archivo);
  return (hojas[0]?.data ?? []) as ImportCell[][];
};

const textoCelda = (valor: unknown) => {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor ?? "").trim();
};

const numeroCelda = (valor: unknown): number => {
  if (typeof valor === "number") return valor;
  const texto = textoCelda(valor).replace(/[^\d,.-]/g, "");
  if (!texto) return Number.NaN;

  const ultimaComa = texto.lastIndexOf(",");
  const ultimoPunto = texto.lastIndexOf(".");
  if (ultimaComa >= 0 && ultimoPunto < 0) {
    const decimales = texto.length - ultimaComa - 1;
    if (decimales === 3) return Number(texto.replace(/,/g, ""));
  }
  if (ultimoPunto >= 0 && ultimaComa < 0) {
    const decimales = texto.length - ultimoPunto - 1;
    if (decimales === 3) return Number(texto.replace(/\./g, ""));
  }
  const separadorDecimal = Math.max(ultimaComa, ultimoPunto);

  if (separadorDecimal < 0) return Number(texto);

  const parteEntera = texto
    .slice(0, separadorDecimal)
    .replace(/[,.]/g, "");
  const parteDecimal = texto.slice(separadorDecimal + 1).replace(/[,.]/g, "");
  return Number(`${parteEntera || "0"}.${parteDecimal}`);
};

const booleanoCelda = (valor: unknown): boolean | null => {
  const normalizado = normalizarEncabezado(valor);
  if (["1", "true", "si", "yes", "activo"].includes(normalizado)) return true;
  if (["0", "false", "no", "inactivo"].includes(normalizado)) return false;
  return null;
};


interface BarcodeScannerProps {
  onDetected: (codigo: string) => void;
  onClose: () => void;
}

function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [errorCamara, setErrorCamara] = useState("");
  const [camaraLista, setCamaraLista] = useState(false);

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
        setErrorCamara(
          "La cámara se abrió, pero no está enviando video. Cerrá otras aplicaciones que la estén usando y volvé a intentar."
        );
      }
    }, 8000);

    const iniciarCamara = async () => {
      try {
        await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result, _error, controls) => {
            controlsRef.current = controls;

            if (!activo) {
              controls.stop();
              return;
            }

            if (result) {
              const codigo = result.getText();

              if (codigo) {
                activo = false;
                controls.stop();
                onDetectedRef.current(codigo);
              }
            }
          }
        );
      } catch (error) {
        console.error("Error al iniciar la cámara:", error);
        if (activo) {
          const nombreError =
            error instanceof DOMException ? error.name : "";
          const mensaje =
            nombreError === "NotAllowedError" ||
            nombreError === "SecurityError"
              ? "El navegador bloqueó el acceso a la cámara. Revisá los permisos del sitio."
              : nombreError === "NotFoundError"
                ? "No se encontró una cámara disponible en esta computadora."
                : nombreError === "NotReadableError" ||
                    nombreError === "AbortError"
                  ? "La cámara está ocupada por otra aplicación. Cerrala y volvé a intentar."
                  : "No se pudo iniciar la cámara. Verificá que el sitio use HTTPS y que el dispositivo esté disponible.";
          setErrorCamara(mensaje);
        }
      }
    };

    iniciarCamara();

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
            Escaneando código de barras
          </p>
          <p className="text-xs text-slate-500">
            Apuntá la cámara al código del producto.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
        >
          Cerrar
        </button>
      </div>

      {errorCamara ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {errorCamara}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            autoPlay
            muted
            playsInline
            onPlaying={() => {
              setCamaraLista(true);
              setErrorCamara("");
            }}
          />

          {!camaraLista && !errorCamara && (
            <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white">
              Conectando con la cámara…
            </p>
          )}

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-[85%] rounded-xl border-2 border-[#D5FF45] shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
          </div>
        </div>
      )}

      {errorCamara ? (
        <p className="mt-3 text-center text-xs text-red-700">{errorCamara}</p>
      ) : (
        <p className="mt-3 text-center text-xs text-slate-500">
          Mantené el código dentro del recuadro y esperá a que lo detecte.
        </p>
      )}
    </div>
  );
}


interface Producto {
  id: string;
  numeroProducto: string;
  identificador: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  category: string;
  image: string;
  stock: number;
  active: boolean;
  createdAt?: {
    toMillis?: () => number;
  };
}

const FORM_INICIAL = {
  numeroProducto: "",
  identificador: "",
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  category: "Almacén",
  stock: "0",
  active: true,
};

const comprimirImagen = (archivo: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    const url = URL.createObjectURL(archivo);

    imagen.onload = async () => {
      URL.revokeObjectURL(url);

      const MAX_SIZE = 1200;
      const MAX_BYTES = 1 * 1024 * 1024;

      let width = imagen.width;
      let height = imagen.height;

      // Redimensionar manteniendo la proporción
      if (width > MAX_SIZE || height > MAX_SIZE) {
        const escala = Math.min(
          MAX_SIZE / width,
          MAX_SIZE / height
        );

        width = Math.round(width * escala);
        height = Math.round(height * escala);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen."));
        return;
      }

      ctx.drawImage(imagen, 0, 0, width, height);

      let calidad = 0.85;

      const generarBlob = (quality: number): Promise<Blob> =>
        new Promise((res, rej) => {
          canvas.toBlob(
            (blob) => {
              if (blob) res(blob);
              else rej(new Error("Error al comprimir la imagen."));
            },
            "image/webp",
            quality
          );
        });

      try {
        let blob = await generarBlob(calidad);

        while (blob.size > MAX_BYTES && calidad > 0.2) {
          calidad -= 0.1;
          blob = await generarBlob(calidad);
        }

        // Si todavía supera 1 MB, reducir las dimensiones
        while (blob.size > MAX_BYTES) {
          width = Math.round(width * 0.85);
          height = Math.round(height * 0.85);

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(imagen, 0, 0, width, height);

          calidad = 0.75;
          blob = await generarBlob(calidad);

          if (width < 300 || height < 300) break;
        }

        const archivoComprimido = new File(
          [blob],
          `${archivo.name.replace(/\.[^/.]+$/, "")}.${
            blob.type === "image/webp" ? "webp" : "png"
          }`,
          {
            type: blob.type || "image/png",
            lastModified: Date.now(),
          }
        );

        resolve(archivoComprimido);
      } catch (error) {
        reject(error);
      }
    };

    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen."));
    };

    imagen.src = url;
  });
};

export default function ProductosAdmin() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [importando, setImportando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(
    null
  );

  const [escaneando, setEscaneando] = useState(false);

  const [form, setForm] = useState(FORM_INICIAL);
  const [imagen, setImagen] = useState<File | null>(null);
  const [procesandoImagen, setProcesandoImagen] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const initialFormRef = useRef(FORM_INICIAL);
  const { confirm, notify } = useNotifications();

  const inputImagenRef = useRef<HTMLInputElement>(null);
  const inputImportRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  // Productos en tiempo real desde Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        const lista = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Producto[];

        lista.sort((a, b) => {
          const fechaA = a.createdAt?.toMillis?.() || 0;
          const fechaB = b.createdAt?.toMillis?.() || 0;
          return fechaB - fechaA;
        });

        setProductos(lista);
        setLoading(false);
      },
      (err) => {
        console.error("Error al cargar productos:", err);
        setError("No se pudieron cargar los productos.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const productosFiltrados = useMemo(() => {
    return productos.filter((producto) => {
      const texto = busqueda.toLowerCase();

      const coincideBusqueda =
        producto.name?.toLowerCase().includes(texto) ||
        producto.description?.toLowerCase().includes(texto) ||
        producto.numeroProducto?.toLowerCase().includes(texto) ||
        producto.identificador?.toLowerCase().includes(texto);

      const coincideCategoria =
        categoriaFiltro === "Todas" ||
        producto.category === categoriaFiltro;

      return coincideBusqueda && coincideCategoria;
    });
  }, [productos, busqueda, categoriaFiltro]);

  const productosActivos = productos.filter(
    (producto) => producto.active !== false
  ).length;

  const formatoPrecio = (precio: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(precio || 0);

  const limpiarFormulario = () => {
    setForm(FORM_INICIAL);
    initialFormRef.current = FORM_INICIAL;
    setImagen(null);
    setPreview("");
    setProductoEditando(null);
    setError("");

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    if (inputImagenRef.current) {
      inputImagenRef.current.value = "";
    }
  };

  const abrirNuevoProducto = () => {
    limpiarFormulario();
    setModalAbierto(true);
  };

  const abrirEditarProducto = (producto: Producto) => {
    setProductoEditando(producto);

    const formProducto = {
      numeroProducto: producto.numeroProducto || "",
      identificador: producto.identificador || "",
      name: producto.name || "",
      description: producto.description || "",
      price: String(producto.price ?? ""),
      originalPrice: String(producto.originalPrice ?? ""),
      category: producto.category || "Otros",
      stock: String(producto.stock ?? 0),
      active: producto.active !== false,
    };

    setForm(formProducto);
    initialFormRef.current = formProducto;
    setImagen(null);
    setPreview(producto.image || "");
    setError("");
    setModalAbierto(true);
  };

  const cerrarModal = useCallback(async () => {
    if (guardando) return;

    if (procesandoImagen) {
      notify("info", "Esperá a que termine de procesarse la imagen.");
      return;
    }

    const hayCambios =
      imagen !== null ||
      JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
    if (
      hayCambios &&
      !(await confirm({
        title: "¿Cerrar sin guardar?",
        message:
          "Los datos que ingresaste y los cambios de este producto se perderán.",
        confirmLabel: "Descartar cambios",
        cancelLabel: "Seguir editando",
      }))
    ) {
      return;
    }

    setModalAbierto(false);
    limpiarFormulario();
  }, [confirm, form, guardando, imagen, notify, procesandoImagen]);

  useEffect(() => {
    if (!modalAbierto) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      void cerrarModal();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [cerrarModal, modalAbierto]);

  const seleccionarImagen = async (archivo?: File) => {
    if (!archivo) return;

    setError("");

    if (!archivo.type.startsWith("image/")) {
      setError("Seleccioná un archivo de imagen válido.");
      if (inputImagenRef.current) inputImagenRef.current.value = "";
      return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
      setError("La imagen original no puede superar los 5 MB.");
      if (inputImagenRef.current) inputImagenRef.current.value = "";
      return;
    }

    setProcesandoImagen(true);
    try {
      const imagenComprimida = await comprimirImagen(archivo);
      const previewUrl = URL.createObjectURL(imagenComprimida);

      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
      previewObjectUrlRef.current = previewUrl;
      setImagen(imagenComprimida);
      setPreview(previewUrl);
    } catch (err) {
      console.error("Error al procesar la imagen:", err);
      setError("No se pudo procesar la imagen. Intentá con otro archivo.");
      notify("error", "No se pudo procesar la imagen del producto.");
      if (inputImagenRef.current) inputImagenRef.current.value = "";
    } finally {
      setProcesandoImagen(false);
    }
  };

  const guardarProducto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMensaje("");

    const nombre = form.name.trim();
    const numeroProducto = form.numeroProducto.trim();
    const identificador = form.identificador.trim();

    if (!numeroProducto) {
      setError("Ingresá el número propio del producto.");
      return;
    }

    const numeroProductoExiste = productos.some(
      (producto) =>
        producto.numeroProducto?.trim().toLowerCase() ===
          numeroProducto.toLowerCase() &&
        producto.id !== productoEditando?.id
    );

    if (numeroProductoExiste) {
      setError("Este número propio ya está asignado a otro producto.");
      return;
    }

    const identificadorExiste = identificador
      ? productos.some(
          (producto) =>
            producto.identificador === identificador &&
            producto.id !== productoEditando?.id
        )
      : false;

    if (identificadorExiste) {
      setError("Este código de barras ya está asignado a otro producto.");
      return;
    }
    const precio = Number(form.price);
    const precioAnterior = form.originalPrice
      ? Number(form.originalPrice)
      : 0;
    const stock = Number(form.stock);

    if (!nombre) {
      setError("Ingresá el nombre del producto.");
      return;
    }

    if (!Number.isFinite(precio) || precio <= 0) {
      setError("Ingresá un precio válido.");
      return;
    }

    if (
      form.originalPrice &&
      (!Number.isFinite(precioAnterior) || precioAnterior <= precio)
    ) {
      setError("El precio anterior debe ser mayor al precio actual.");
      return;
    }

    if (!Number.isFinite(stock) || stock < 0) {
      setError("Ingresá un stock válido.");
      return;
    }

    setGuardando(true);

    try {
      let imagenUrl = productoEditando?.image || "";

      if (imagen) {
        const nombreArchivo = `${Date.now()}-${imagen.name.replace(
          /[^a-zA-Z0-9.-]/g,
          "_"
        )}`;

        const imagenRef = ref(storage, `productos/${nombreArchivo}`);

        await uploadBytes(imagenRef, imagen, {
          contentType: imagen.type || "image/webp",
        });
        imagenUrl = await getDownloadURL(imagenRef);
      }

      const datosProducto = {
        name: nombre,
        numeroProducto,
        identificador: identificador,
        description: form.description.trim(),
        price: precio,
        originalPrice: precioAnterior,
        category: form.category,
        image: imagenUrl,
        stock,
        active: form.active,
        updatedAt: serverTimestamp(),
      };

      if (productoEditando) {
        await updateDoc(doc(db, "productos", productoEditando.id), {
          ...datosProducto,
        });

        setMensaje("Producto actualizado correctamente.");
        notify("success", "Producto actualizado correctamente.");
      } else {
        await addDoc(collection(db, "productos"), {
          ...datosProducto,
          createdAt: serverTimestamp(),
        });

        setMensaje("Producto agregado correctamente.");
        notify("success", "Producto agregado correctamente.");
      }

      setModalAbierto(false);
      limpiarFormulario();
    } catch (err) {
      console.error("Error al guardar producto:", err);
      setError("No se pudo guardar el producto. Intentá nuevamente.");
      notify("error", "No se pudo guardar el producto. Intentá nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  const importarProductos = async (archivo?: File) => {
    if (!archivo) return;

    setError("");
    setMensaje("");

    if (archivo.size > 10 * 1024 * 1024) {
      setError("El archivo no puede superar los 10 MB.");
      if (inputImportRef.current) inputImportRef.current.value = "";
      return;
    }

    setImportando(true);

    try {
      const filas = await leerPlanilla(archivo);
      if (filas.length < 2) {
        throw new Error("La planilla está vacía o no tiene filas de productos.");
      }

      const encabezados = filas[0].map((valor) => normalizarEncabezado(valor));
      const indiceNumero = encabezados.findIndex((header) =>
        [
          "numeroproducto",
          "numerointerno",
          "codigoproducto",
          "codigointerno",
          "nroproducto",
          "nrointerno",
        ].includes(header)
      );

      if (indiceNumero < 0) {
        throw new Error(
          "No encuentro la columna numeroProducto. Usá la plantilla para respetar los encabezados."
        );
      }

      const encontrarValor = (
        fila: ImportCell[],
        nombres: string[]
      ): { presente: boolean; valor: unknown } => {
        for (const nombre of nombres) {
          const indice = encabezados.indexOf(normalizarEncabezado(nombre));
          if (indice >= 0) {
            return { presente: true, valor: fila[indice] ?? "" };
          }
        }
        return { presente: false, valor: "" };
      };

      const productosPorNumero = new Map<string, Producto>();
      const numerosDuplicados = new Set<string>();
      productos.forEach((producto) => {
        const numero = textoCelda(producto.numeroProducto).toLowerCase();
        if (!numero) return;
        if (productosPorNumero.has(numero)) {
          numerosDuplicados.add(numero);
        } else {
          productosPorNumero.set(numero, producto);
        }
      });

      const codigosBarras = new Map<string, string>();
      productos.forEach((producto) => {
        const codigo = textoCelda(producto.identificador);
        if (codigo) codigosBarras.set(codigo, producto.id);
      });

      const numerosEnArchivo = new Set<string>();
      const operaciones: {
        referencia: ReturnType<typeof doc>;
        datos: Record<string, unknown>;
        nuevo: boolean;
      }[] = [];
      const detallesError: string[] = [];
      let omitidos = 0;

      filas.slice(1).forEach((fila, indice) => {
        const numeroProducto = textoCelda(fila[indiceNumero]);
        const numeroClave = numeroProducto.toLowerCase();
        const numeroFila = indice + 2;

        if (!numeroProducto) {
          omitidos += 1;
          detallesError.push(`Fila ${numeroFila}: falta numeroProducto.`);
          return;
        }

        if (numerosEnArchivo.has(numeroClave)) {
          omitidos += 1;
          detallesError.push(
            `Fila ${numeroFila}: numeroProducto ${numeroProducto} repetido en la planilla.`
          );
          return;
        }
        numerosEnArchivo.add(numeroClave);

        if (numerosDuplicados.has(numeroClave)) {
          omitidos += 1;
          detallesError.push(
            `Fila ${numeroFila}: el número ${numeroProducto} ya está duplicado en el catálogo.`
          );
          return;
        }

        const existente = productosPorNumero.get(numeroClave);
        const nombreCelda = encontrarValor(fila, ["nombre", "name", "producto"]);
        const codigoCelda = encontrarValor(fila, [
          "codigoBarras",
          "barcode",
          "identificador",
          "ean",
        ]);
        const descripcionCelda = encontrarValor(fila, [
          "descripcion",
          "description",
        ]);
        const precioCelda = encontrarValor(fila, ["precio", "price"]);
        const precioAnteriorCelda = encontrarValor(fila, [
          "precioAnterior",
          "precioOriginal",
          "originalPrice",
        ]);
        const categoriaCelda = encontrarValor(fila, ["categoria", "category"]);
        const stockCelda = encontrarValor(fila, ["stock", "existencias"]);
        const imagenCelda = encontrarValor(fila, ["imagen", "image", "urlImagen"]);
        const activoCelda = encontrarValor(fila, ["activo", "active"]);
        const nuevo = !existente;
        const datos: Record<string, unknown> = {
          numeroProducto,
          updatedAt: serverTimestamp(),
        };
        if (nuevo) {
          datos.identificador = "";
          datos.image = "";
        }
        const fallarFila = (motivo: string) => {
          omitidos += 1;
          detallesError.push(`Fila ${numeroFila}: ${motivo}`);
        };

        const nombre = textoCelda(nombreCelda.valor);
        if (nombreCelda.presente && nombre) datos.name = nombre;
        if (nuevo && !nombre) {
          fallarFila("para crear el producto falta nombre.");
          return;
        }

        const precioTexto = textoCelda(precioCelda.valor);
        const precio = precioCelda.presente && precioTexto
          ? numeroCelda(precioCelda.valor)
          : existente?.price;
        if (precioCelda.presente && precioTexto) {
          if (!Number.isFinite(precio) || Number(precio) <= 0) {
            fallarFila("el precio debe ser mayor a cero.");
            return;
          }
          datos.price = Number(precio);
        }
        if (nuevo && precio === undefined) {
          fallarFila("para crear el producto falta precio.");
          return;
        }

        const precioAnteriorTexto = textoCelda(precioAnteriorCelda.valor);
        const precioAnterior = precioAnteriorCelda.presente && precioAnteriorTexto
          ? numeroCelda(precioAnteriorCelda.valor)
          : existente?.originalPrice ?? 0;
        if (precioAnteriorCelda.presente && precioAnteriorTexto) {
          if (
            !Number.isFinite(precioAnterior) ||
            Number(precioAnterior) < 0 ||
            (Number(precioAnterior) > 0 &&
              Number(precioAnterior) <= Number(precio))
          ) {
            fallarFila("el precio anterior debe superar al precio actual.");
            return;
          }
          datos.originalPrice = Number(precioAnterior);
        }

        const stockTexto = textoCelda(stockCelda.valor);
        if (stockCelda.presente && stockTexto) {
          const stock = numeroCelda(stockCelda.valor);
          if (!Number.isInteger(stock) || stock < 0) {
            fallarFila("el stock debe ser un número entero igual o mayor a cero.");
            return;
          }
          datos.stock = stock;
        } else if (nuevo) {
          datos.stock = 0;
        }

        const categoria = textoCelda(categoriaCelda.valor);
        if (categoriaCelda.presente && categoria) {
          if (!CATEGORIAS.includes(categoria)) {
            fallarFila(`la categoría "${categoria}" no es válida.`);
            return;
          }
          datos.category = categoria;
        } else if (nuevo) {
          datos.category = "Almacén";
        }

        const descripcion = textoCelda(descripcionCelda.valor);
        if (descripcionCelda.presente && descripcion) {
          datos.description = descripcion;
        } else if (nuevo) {
          datos.description = "";
        }

        const imagenUrl = textoCelda(imagenCelda.valor);
        if (imagenCelda.presente && imagenUrl) datos.image = imagenUrl;
        else if (nuevo) datos.image = "";

        const codigoBarras = textoCelda(codigoCelda.valor);
        if (codigoCelda.presente && codigoBarras) {
          const dueño = codigosBarras.get(codigoBarras);
          if (dueño && dueño !== existente?.id) {
            fallarFila(`el código de barras ${codigoBarras} ya pertenece a otro producto.`);
            return;
          }
          datos.identificador = codigoBarras;
          codigosBarras.set(codigoBarras, existente?.id ?? numeroClave);
        }

        const activoTexto = textoCelda(activoCelda.valor);
        if (activoCelda.presente && activoTexto) {
          const activo = booleanoCelda(activoCelda.valor);
          if (activo === null) {
            fallarFila('activo debe ser "si" o "no".');
            return;
          }
          datos.active = activo;
        } else if (nuevo) {
          datos.active = true;
        }

        if (nuevo) {
          datos.createdAt = serverTimestamp();
        } else if (Object.keys(datos).length === 2) {
          fallarFila("no hay datos para actualizar además del número.");
          return;
        }

        const referencia = existente
          ? doc(db, "productos", existente.id)
          : doc(collection(db, "productos"));
        operaciones.push({ referencia, datos, nuevo });
      });

      if (operaciones.length === 0) {
        throw new Error(
          detallesError.slice(0, 5).join(" ") ||
            "La planilla no contiene filas válidas para importar."
        );
      }

      let creados = 0;
      let actualizados = 0;
      for (let inicio = 0; inicio < operaciones.length; inicio += 450) {
        const lote = writeBatch(db);
        const grupo = operaciones.slice(inicio, inicio + 450);
        grupo.forEach((operacion) => {
          if (operacion.nuevo) {
            lote.set(operacion.referencia, operacion.datos);
            creados += 1;
          } else {
            lote.update(operacion.referencia, operacion.datos);
            actualizados += 1;
          }
        });
        await lote.commit();
      }

      setMensaje(
        `Importación finalizada: ${creados} creados y ${actualizados} actualizados.${
          omitidos ? ` ${omitidos} filas omitidas.` : ""
        }`
      );
      notify(
        omitidos ? "info" : "success",
        `Importación finalizada: ${creados} creados y ${actualizados} actualizados.${
          omitidos ? ` ${omitidos} filas omitidas.` : ""
        }`
      );
      if (detallesError.length) {
        setError(
          `${detallesError.slice(0, 5).join(" ")}${
            detallesError.length > 5
              ? ` Y ${detallesError.length - 5} errores más; revisá la planilla.`
              : ""
          }`
        );
        notify("error", "Algunas filas no se pudieron importar. Revisá el detalle.");
        console.warn("Filas omitidas en la importación:", detallesError);
      }
    } catch (err) {
      console.error("Error al importar productos:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo importar la planilla."
      );
      notify(
        "error",
        err instanceof Error ? err.message : "No se pudo importar la planilla."
      );
    } finally {
      setImportando(false);
      if (inputImportRef.current) inputImportRef.current.value = "";
    }
  };

  const descargarPlantilla = () => {
    const encabezados = [
      "numeroProducto",
      "codigoBarras",
      "nombre",
      "descripcion",
      "precio",
      "precioAnterior",
      "categoria",
      "stock",
      "imagen",
      "activo",
    ];
    const contenido = `\uFEFF${encabezados.join(";")}\r\n`;
    const url = URL.createObjectURL(
      new Blob([contenido], { type: "text/csv;charset=utf-8" })
    );
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "plantilla-productos-pipes.csv";
    enlace.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const eliminarProducto = async (producto: Producto) => {
    const confirmar = await confirm({
      title: "¿Eliminar producto?",
      message: `Se eliminará "${producto.name}". Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar producto",
      cancelLabel: "Cancelar",
    });

    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "productos", producto.id));
      setMensaje("Producto eliminado correctamente.");
      setError("");
      notify("success", "Producto eliminado correctamente.");
    } catch (err) {
      console.error("Error al eliminar producto:", err);
      setError("No se pudo eliminar el producto.");
      notify("error", "No se pudo eliminar el producto.");
    }
  };

  const cambiarEstado = async (producto: Producto) => {
    try {
      await updateDoc(doc(db, "productos", producto.id), {
        active: producto.active === false,
        updatedAt: serverTimestamp(),
      });
      notify(
        "success",
        producto.active === false
          ? "Producto activado."
          : "Producto desactivado."
      );
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      setError("No se pudo actualizar el estado del producto.");
      notify("error", "No se pudo actualizar el estado del producto.");
    }
  };

  return (
    <div className="space-y-7">
      {/* ENCABEZADO */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#10489f]">
            <Package size={17} />
            CATÁLOGO
          </div>

          <h2 className="text-2xl font-black tracking-tight text-[#142c4e] sm:text-3xl">
            Gestión de productos
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Administrá el catálogo, los precios y el stock de PIPES.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputImportRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(event) => {
              const archivo = event.target.files?.[0];
              void importarProductos(archivo);
            }}
          />
          <button
            type="button"
            onClick={descargarPlantilla}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-[#142c4e] transition hover:bg-slate-50"
          >
            <Download size={18} />
            Plantilla
          </button>
          <button
            type="button"
            onClick={() => inputImportRef.current?.click()}
            disabled={importando}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#142c4e] px-4 py-3.5 text-sm font-bold text-[#142c4e] transition hover:bg-blue-50 disabled:opacity-60"
          >
            {importando ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <FileSpreadsheet size={18} />
            )}
            {importando ? "Importando..." : "Importar Excel"}
          </button>
          <button
            type="button"
            onClick={abrirNuevoProducto}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#142c4e] px-5 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#10489f]"
          >
            <Plus size={19} />
            Agregar producto
          </button>
        </div>
      </div>

      <p className="-mt-4 text-xs text-slate-500">
        Importá XLSX o CSV. El número propio identifica cada producto: si existe
        se actualiza; si no, se crea. Encabezados: numeroProducto, codigoBarras,
        nombre, descripcion, precio, precioAnterior, categoria, stock, imagen y
        activo. Las celdas vacías conservan los datos existentes. Para conservar
        ceros iniciales, guardá numeroProducto como texto en Excel.
      </p>

      {/* MENSAJES */}
      {mensaje && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <CheckCircle2 size={19} />
          {mensaje}
          <button onClick={() => setMensaje("")} className="ml-auto">
            <X size={17} />
          </button>
        </div>
      )}

      {error && !modalAbierto && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={19} />
          {error}
          <button onClick={() => setError("")} className="ml-auto">
            <X size={17} />
          </button>
        </div>
      )}

      {/* ESTADÍSTICAS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Total de productos
              </p>
              <p className="mt-2 text-3xl font-black text-[#142c4e]">
                {productos.length}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-[#10489f]">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Productos activos
              </p>
              <p className="mt-2 text-3xl font-black text-[#142c4e]">
                {productosActivos}
              </p>
            </div>
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Categorías
              </p>
              <p className="mt-2 text-3xl font-black text-[#142c4e]">
                {CATEGORIAS.length}
              </p>
            </div>
            <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
              <Boxes size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* BUSCADOR Y FILTROS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto por nombre..."
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-3.5 pl-12 pr-4 text-sm outline-none transition focus:border-[#10489f] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <Tag size={18} className="shrink-0 text-slate-400" />
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm font-semibold outline-none focus:border-[#10489f] sm:w-64"
            >
              <option value="Todas">Todas las categorías</option>
              {CATEGORIAS.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>{productosFiltrados.length} productos encontrados</span>
          <button
            onClick={() => {
              setBusqueda("");
              setCategoriaFiltro("Todas");
            }}
            className="font-bold text-[#10489f] hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* LISTADO */}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center gap-3 text-sm font-semibold text-slate-500">
          <Loader2 className="animate-spin" size={22} />
          Cargando productos...
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-20 text-center">
          <Package size={42} className="mx-auto text-slate-300" />
          <h3 className="mt-4 text-lg font-black text-[#142c4e]">
            No hay productos para mostrar
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Agregá un producto o modificá los filtros de búsqueda.
          </p>
          <button
            onClick={abrirNuevoProducto}
            className="mt-5 rounded-xl bg-[#142c4e] px-5 py-3 text-sm font-bold text-white hover:bg-[#10489f]"
          >
            Agregar primer producto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {productosFiltrados.map((producto) => (
            <article
              key={producto.id}
              className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                producto.active === false ? "opacity-65" : ""
              }`}
            >
              <div className="relative flex h-48 items-center justify-center bg-[#F8FAFC] p-5">
                {producto.image ? (
                  <img
                    src={producto.image}
                    alt={producto.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <ImagePlus size={40} />
                    <span className="text-xs font-semibold">Sin imagen</span>
                  </div>
                )}

                <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#10489f] shadow-sm">
                  {producto.category}
                </span>

                {producto.originalPrice > producto.price &&
                  producto.originalPrice > 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-[#d5ff45] px-3 py-1.5 text-xs font-black text-[#142c4e]">
                      OFERTA
                    </span>
                  )}
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-black text-[#142c4e]">
                      {producto.name}
                    </h3>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                        producto.active === false
                          ? "bg-red-50 text-red-600"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {producto.active === false ? "Inactivo" : "Activo"}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-slate-500">
                    {producto.description || "Sin descripción"}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    N.º propio: {producto.numeroProducto || "Sin asignar"}
                  </p>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    {producto.originalPrice > producto.price &&
                      producto.originalPrice > 0 && (
                        <p className="text-xs text-slate-400 line-through">
                          {formatoPrecio(producto.originalPrice)}
                        </p>
                      )}
                    <p className="text-xl font-black text-[#10489f]">
                      {formatoPrecio(producto.price)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">
                      Stock
                    </p>
                    <p className="text-sm font-black text-[#142c4e]">
                      {producto.stock ?? 0} unidades
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => abrirEditarProducto(producto)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-50 py-2.5 text-xs font-bold text-[#10489f] transition hover:bg-blue-100"
                  >
                    <Pencil size={15} />
                    Editar
                  </button>

                  <button
                    onClick={() => cambiarEstado(producto)}
                    title={
                      producto.active === false
                        ? "Activar producto"
                        : "Desactivar producto"
                    }
                    className="rounded-lg bg-slate-100 px-3 text-slate-600 transition hover:bg-slate-200"
                  >
                    {producto.active === false ? (
                      <Eye size={17} />
                    ) : (
                      <EyeOff size={17} />
                    )}
                  </button>

                  <button
                    onClick={() => eliminarProducto(producto)}
                    title="Eliminar producto"
                    className="rounded-lg bg-red-50 px-3 text-red-500 transition hover:bg-red-100"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}


{/* MODAL */}
{modalAbierto && (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#142c4e]/60 p-3 backdrop-blur-sm sm:p-6"
    onClick={(e) => {
      if (e.target === e.currentTarget) {
        setEscaneando(false);
        cerrarModal();
      }
    }}
  >
    <div className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
      {/* ENCABEZADO */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#10489f]">
            Catálogo PIPES
          </p>
          <h2 className="mt-1 text-xl font-black text-[#142c4e]">
            {productoEditando ? "Editar producto" : "Nuevo producto"}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            setEscaneando(false);
            cerrarModal();
          }}
          disabled={guardando}
          className="rounded-xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200"
        >
          <X size={20} />
        </button>
      </div>

      <form
        onSubmit={guardarProducto}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") {
            e.preventDefault();
          }
        }}
      >
        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          {/* ERROR */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* IMAGEN */}
          <div>
            <label className="mb-2 block text-sm font-bold text-[#142c4e]">
              Imagen del producto
            </label>

            <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-[#F8FAFC] p-5 sm:flex-row">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                {preview ? (
                  <img
                    src={preview}
                    alt="Vista previa"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImagePlus size={38} className="text-slate-300" />
                )}
              </div>

              <div className="flex-1 text-center sm:text-left">
                <p className="text-sm font-bold text-[#142c4e]">
                  Subí una foto del producto
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  JPG, PNG o WEBP. Máximo 5 MB.
                </p>

                <button
                  type="button"
                  onClick={() => inputImagenRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#142c4e] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#10489f]"
                >
                  <Upload size={15} />
                  Seleccionar imagen
                </button>

                <input
                  ref={inputImagenRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    e.target.value = "";
                    void seleccionarImagen(archivo);
                  }}
                />
              </div>
            </div>
          </div>

          {/* NÚMERO PROPIO */}
          <div>
            <label className="mb-2 block text-sm font-bold text-[#142c4e]">
              Número propio del producto *
            </label>
            <input
              type="text"
              value={form.numeroProducto}
              onChange={(e) =>
                setForm({ ...form, numeroProducto: e.target.value.trimStart() })
              }
              placeholder="Ej: 00125 o ART-125"
              required
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm outline-none focus:border-[#10489f] focus:bg-white"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Es único y distinto del código de barras y del ID interno.
            </p>
          </div>

          {/* IDENTIFICADOR / CÓDIGO DE BARRAS */}
          <div>
            <label className="mb-2 block text-sm font-bold text-[#142c4e]">
              Código de barras (opcional)
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={form.identificador}
                onChange={(e) =>
                  setForm({
                    ...form,
                    identificador: e.target.value.replace(/\D/g, ""),
                  })
                }
                placeholder="Ej: 7791234567890"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm outline-none focus:border-[#10489f] focus:bg-white"
              />

              <button
                type="button"
                onClick={() => setEscaneando((prev) => !prev)}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-[#142c4e] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#10489f]"
              >
                <Camera size={18} />
                <span className="hidden sm:inline">
                  {escaneando ? "Cerrar cámara" : "Escanear"}
                </span>
                <span className="sm:hidden">Leer</span>
              </button>
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              Podés escribirlo o escanearlo. El número propio también permite ubicar el producto.
            </p>

            {escaneando && (
              <div className="mt-4">
                <BarcodeScanner
                  onDetected={(codigo) => {
                    setForm((prev) => ({
                      ...prev,
                      identificador: codigo.replace(/\D/g, ""),
                    }));
                    setEscaneando(false);
                    setError("");
                  }}
                  onClose={() => setEscaneando(false)}
                />
              </div>
            )}
          </div>

          {/* NOMBRE */}
          <div>
            <label className="mb-2 block text-sm font-bold text-[#142c4e]">
              Nombre del producto *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              placeholder="Ej: Coca Cola 2.25 L"
              required
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm outline-none focus:border-[#10489f] focus:bg-white"
            />
          </div>

          {/* DESCRIPCIÓN */}
          <div>
            <label className="mb-2 block text-sm font-bold text-[#142c4e]">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Descripción del producto..."
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm outline-none focus:border-[#10489f] focus:bg-white"
            />
          </div>

          {/* CATEGORÍA */}
          <div>
            <label className="mb-2 block text-sm font-bold text-[#142c4e]">
              Categoría *
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm outline-none focus:border-[#10489f]"
            >
              {CATEGORIAS.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>

          {/* PRECIOS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-[#142c4e]">
                Precio actual *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value })
                  }
                  placeholder="2500"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-3 pl-9 pr-4 text-sm outline-none focus:border-[#10489f]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#142c4e]">
                Precio anterior
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.originalPrice}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      originalPrice: e.target.value,
                    })
                  }
                  placeholder="3000"
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] py-3 pl-9 pr-4 text-sm outline-none focus:border-[#10489f]"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Opcional. Para mostrar una oferta.
              </p>
            </div>
          </div>

          {/* STOCK */}
          <div>
            <label className="mb-2 block text-sm font-bold text-[#142c4e]">
              Cantidad en stock
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) =>
                setForm({ ...form, stock: e.target.value })
              }
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm outline-none focus:border-[#10489f]"
            />
          </div>

          {/* ESTADO */}
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4">
            <div>
              <p className="text-sm font-bold text-[#142c4e]">
                Producto visible
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Los productos inactivos no deberían mostrarse en el mercado.
              </p>
            </div>

            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm({ ...form, active: e.target.checked })
              }
              className="h-5 w-5 accent-[#10489f]"
            />
          </label>
        </div>

        {/* ACCIONES */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-white p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setEscaneando(false);
              cerrarModal();
            }}
            disabled={guardando}
            className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={guardando || escaneando}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#142c4e] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#10489f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle2 size={17} />
                {productoEditando ? "Guardar cambios" : "Crear producto"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </div>
  );
}
