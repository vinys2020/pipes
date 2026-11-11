
import { useState, type FormEvent } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";

import { auth } from "../firebase/auth";
import { db } from "../firebase/config";
import Navbar from "../components/Navbar";

export default function Registro() {
  const navigate = useNavigate();

  const [searchNavbar, setSearchNavbar] = useState("");
  const [activeCategoryNavbar, setActiveCategoryNavbar] =
    useState("Todos");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const guardarUsuarioEnFirestore = async (
    user: User,
    nombreUsuario: string,
    proveedor: "email" | "google"
  ) => {
    const usuarioRef = doc(db, "usuarios", user.uid);
    const usuarioExistente = await getDoc(usuarioRef);

    if (!usuarioExistente.exists()) {
      await setDoc(usuarioRef, {
        nombre: nombreUsuario,
        email: user.email ?? "",
        rol: "cliente",
        activo: true,
        proveedor,
        creadoEn: serverTimestamp(),
      });
    }
  };

  const obtenerCodigoError = (err: unknown): string => {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      typeof err.code === "string"
    ) {
      return err.code;
    }

    return "";
  };

  const traducirError = (code: string) => {
    const errores: Record<string, string> = {
      "auth/email-already-in-use":
        "Ya existe una cuenta registrada con ese correo.",
      "auth/invalid-email":
        "Ingresá un correo electrónico válido.",
      "auth/weak-password":
        "La contraseña debe tener al menos 6 caracteres.",
      "auth/popup-closed-by-user":
        "Cerraste la ventana de Google.",
      "auth/popup-blocked":
        "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes e intentá otra vez.",
      "auth/network-request-failed":
        "No se pudo conectar. Revisá tu conexión a internet.",
      "auth/unauthorized-domain":
        "Este dominio no está autorizado en Firebase Authentication.",
      "permission-denied":
        "Firebase bloqueó el guardado del usuario. Revisá las reglas de Firestore.",
      "auth/operation-not-allowed":
        "Este método de registro no está habilitado en Firebase Authentication.",
    };

    return (
      errores[code] ||
      "No se pudo crear la cuenta. Intentá nuevamente."
    );
  };

  const registrarse = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (nombre.trim().length < 2) {
      setError("Ingresá tu nombre para continuar.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(credential.user, {
        displayName: nombre.trim(),
      });

      await guardarUsuarioEnFirestore(
        credential.user,
        nombre.trim(),
        "email"
      );

    navigate("/cliente", { replace: true });
    } catch (err) {
      setError(traducirError(obtenerCodigoError(err)));
    } finally {
      setLoading(false);
    }
  };

  const registrarseConGoogle = async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: "select_account",
      });

      const credential = await signInWithPopup(auth, provider);

      const nombreUsuario =
        credential.user.displayName ||
        credential.user.email?.split("@")[0] ||
        "Cliente";

      await guardarUsuarioEnFirestore(
        credential.user,
        nombreUsuario,
        "google"
      );

      navigate("/", { replace: true });
    } catch (err) {
      setError(traducirError(obtenerCodigoError(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar
        search={searchNavbar}
        setSearch={setSearchNavbar}
        cartCount={0}
        activeCategory={activeCategoryNavbar}
        setActiveCategory={setActiveCategoryNavbar}
        categories={[]}
        mobileOnly
      />

      <main className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4 py-10">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#10489f]"
          >
            <span aria-hidden="true">←</span>
            Volver al mercado
          </Link>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_15px_60px_rgba(20,44,78,.08)] sm:p-9">
            <Link to="/" className="mb-8 flex justify-center">
              <img
                src="/logonav.png"
                alt="PIPES — Súper almacén"
                className="h-14 w-40 object-contain"
              />
            </Link>

            <div className="mb-7 text-center">
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[#10489f]">
                Sumate a PIPES
              </p>

              <h1 className="text-3xl font-black tracking-tight text-[#142C4E]">
                Creá tu cuenta
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Registrate para empezar a comprar.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={registrarseConGoogle}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-[#142C4E] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg
                viewBox="0 0 48 48"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.63 5.92c4.46-4.12 7.14-10.2 7.14-17.57Z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.91-5.88l-7.63-5.92c-2.12 1.42-4.83 2.26-8.28 2.26-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
                />
              </svg>

              {loading
                ? "Procesando..."
                : "Registrarme con Google"}
            </button>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-400">
                O completá tus datos
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={registrarse} className="space-y-4">
              <div>
                <label
                  htmlFor="register-name"
                  className="mb-2 block text-sm font-bold text-[#142C4E]"
                >
                  Nombre y apellido
                </label>

                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  placeholder="Tu nombre completo"
                  required
                  minLength={2}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#10489f] focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="register-email"
                  className="mb-2 block text-sm font-bold text-[#142C4E]"
                >
                  Correo electrónico
                </label>

                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#10489f] focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="register-password"
                  className="mb-2 block text-sm font-bold text-[#142C4E]"
                >
                  Contraseña
                </label>

                <input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  minLength={6}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#10489f] focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
                />
              </div>

              <div>
                <label
                  htmlFor="register-confirm-password"
                  className="mb-2 block text-sm font-bold text-[#142C4E]"
                >
                  Confirmar contraseña
                </label>

                <input
                  id="register-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmarPassword}
                  onChange={(event) =>
                    setConfirmarPassword(event.target.value)
                  }
                  placeholder="Repetí tu contraseña"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#10489f] focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#142C4E] px-4 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#10489f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-500">
              ¿Ya tenés una cuenta?{" "}
              <Link
                to="/login"
                className="font-extrabold text-[#10489f] hover:underline"
              >
                Iniciá sesión
              </Link>
            </p>
          </section>

          <p className="mt-6 text-center text-xs text-slate-400">
            PIPES · Súper almacén
          </p>
        </div>
      </main>
    </>
  );
}
