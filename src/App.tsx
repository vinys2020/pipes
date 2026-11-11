
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import Cliente from "./pages/Cliente";
import Admin from "./pages/Admin";
import Mercado from "./pages/Mercado";
import Promos from "./pages/Promos";
import PedidosCliente from "./pages/PedidosCliente";
import { NotificationProvider } from "./components/NotificationProvider";

type SplashPhase = "loading" | "leaving" | "done";

function SplashScreen({ phase }: { phase: Exclude<SplashPhase, "done"> }) {
  return (
    <main
      className={`app-splash${phase === "leaving" ? " app-splash--exit" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="app-splash__content">
        <div className="app-splash__brand">
          <img
            className="app-splash__logo"
            src="/logotipo.png"
            alt="PIPES Mercado & Beer"
            fetchPriority="high"
          />
        </div>
        <div className="app-splash__loading">
          <span className="app-splash__spinner" aria-hidden="true" />
          <span>Preparando tu mercado</span>
          <span className="app-splash__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="app-splash__progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}

function App() {
  const [splashPhase, setSplashPhase] = useState<SplashPhase>("loading");

  useEffect(() => {
    const leaveTimer = window.setTimeout(
      () => setSplashPhase("leaving"),
      1800
    );
    return () => window.clearTimeout(leaveTimer);
  }, []);

  useEffect(() => {
    if (splashPhase !== "leaving") return;
    const removeTimer = window.setTimeout(() => setSplashPhase("done"), 260);
    return () => window.clearTimeout(removeTimer);
  }, [splashPhase]);

  return (
    <NotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/cliente" element={<Cliente />} />
          <Route path="/pedidos" element={<PedidosCliente />} />
          <Route path="/mercado" element={<Mercado />} />
          <Route path="/promos" element={<Promos />} />
          <Route path="/*" element={<Home />} />
        </Routes>
      </BrowserRouter>
      {splashPhase !== "done" && <SplashScreen phase={splashPhase} />}
    </NotificationProvider>
  );
}

export default App;
