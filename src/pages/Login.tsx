import { useState, type FormEvent } from "react";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase/auth";
import { db } from "../firebase/config";
import Navbar from "../components/Navbar";

export default function Login() {
  const navigate = useNavigate();

  const [searchNavbar, setSearchNavbar] = useState("");
  const [activeCategoryNavbar, setActiveCategoryNavbar] = useState("Todos");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const traducirError = (code: string) => {
    const errores: Record<string, string> = {
      "auth/invalid-email": "Ingresá un correo electrónico válido.",
      "auth/invalid-credential": "El correo o la contraseña son incorrectos.",
      "auth/user-not-found": "No existe una cuenta con ese correo.",
      "auth/wrong-password": "La contraseña es incorrecta.",
      "auth/too-many-requests":
        "Hubo demasiados intentos. Esperá unos minutos e intentá nuevamente.",
      "auth/popup-closed-by-user": "Cerraste la ventana de Google.",
      "auth/popup-blocked":
        "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes e intentá otra vez.",
      "auth/network-request-failed":
        "No se pudo conectar. Revisá tu conexión a internet.",
      "auth/unauthorized-domain":
        "Este dominio no está autorizado en Firebase Authentication.",
    };

    return errores[code] || "Ocurrió un error. Intentá nuevamente.";
  };

  const redirigirSegunRol = async (uid: string) => {
    const usuarioRef = doc(db, "usuarios", uid);
    const usuarioSnap = await getDoc(usuarioRef);

    if (!usuarioSnap.exists()) {
      await signOut(auth);
      setError("No encontramos tu perfil. Contactá con la administración.");
      return;
    }

    const usuario = usuarioSnap.data();

    if (usuario.activo !== true) {
      await signOut(auth);
      setError("Tu cuenta no está habilitada. Contactá con la administración.");
      return;
    }

    if (usuario.rol === "admin") {
      navigate("/admin", { replace: true });
      return;
    }

    if (usuario.rol === "cliente") {
      navigate("/cliente", { replace: true });
      return;
    }

    await signOut(auth);
    setError("No tenés permisos para ingresar al sistema.");
  };

  const obtenerCodigoError = (err: unknown) => {
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

  const iniciarSesion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMensaje("");
    setLoading(true);

    try {
      const resultado = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await redirigirSegunRol(resultado.user.uid);
    } catch (err) {
      setError(traducirError(obtenerCodigoError(err)));

      if (auth.currentUser) {
        await signOut(auth);
      }
    } finally {
      setLoading(false);
    }
  };

  const iniciarConGoogle = async () => {
    setError("");
    setMensaje("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const resultado = await signInWithPopup(auth, provider);

      await redirigirSegunRol(resultado.user.uid);
    } catch (err) {
      setError(traducirError(obtenerCodigoError(err)));

      if (auth.currentUser) {
        await signOut(auth);
      }
    } finally {
      setLoading(false);
    }
  };

  const recuperarPassword = async () => {
    setError("");
    setMensaje("");

    if (!email.trim()) {
      setError("Ingresá tu correo para enviarte el enlace de recuperación.");
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMensaje(
        "Si el correo corresponde a una cuenta, recibirás las instrucciones para restablecer tu contraseña."
      );
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
              Tu cuenta PIPES
            </p>

            <h1 className="text-3xl font-black tracking-tight text-[#142C4E]">
              ¡Qué bueno verte!
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ingresá a tu cuenta para continuar.
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

          {mensaje && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              {mensaje}
            </div>
          )}

          <button
            type="button"
            onClick={iniciarConGoogle}
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

            {loading ? "Procesando..." : "Continuar con Google"}
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">
              O ingresá con tu correo
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={iniciarSesion} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-bold text-[#142C4E]"
              >
                Correo electrónico
              </label>

              <input
                id="login-email"
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
                htmlFor="login-password"
                className="mb-2 block text-sm font-bold text-[#142C4E]"
              >
                Contraseña
              </label>

              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresá tu contraseña"
                required
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#10489f] focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60"
              />

              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={recuperarPassword}
                  disabled={loading}
                  className="text-xs font-bold text-[#10489f] transition hover:underline disabled:opacity-60"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#142C4E] px-4 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-950/10 transition hover:bg-[#10489f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            ¿Todavía no tenés cuenta?{" "}
            <Link
              to="/registro"
              className="font-extrabold text-[#10489f] hover:underline"
            >
              Registrate
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
