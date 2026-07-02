import React from "react";
import { registerSW } from "virtual:pwa-register";
import { captureAppError, initObservability } from "@/lib/observability";
import { setupPerformanceObservers } from "@/lib/performance";

// Detecta fallos de carga de un chunk lazy. Pasa cuando se hizo deploy mientras
// el usuario tenía la pestaña abierta: al volver y navegar, el navegador pide un
// chunk con hash viejo que ya no existe (404). No es un bug de la app — recargar
// trae los chunks nuevos y deja al usuario en la MISMA URL donde estaba.
function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const name = error instanceof Error ? error.name : "";
  return (
    name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /is not a valid JavaScript MIME type/i.test(msg)
  );
}

// Recarga una sola vez por incidente: si ya recargamos hace <10s no volvemos a
// hacerlo (evita loop infinito si el chunk falta por otra razón) y dejamos que
// se muestre la tarjeta de error. window.location.reload() conserva la URL.
const CHUNK_RELOAD_KEY = "skale:chunk-reload-at";
function reloadForFreshChunks(): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - last < 10_000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage bloqueado (modo incógnito estricto): recargar igual */
  }
  window.location.reload();
  return true;
}

// Vite emite este evento cuando falla el preload de un chunk tras un deploy.
// Sin manejarlo, la promesa del import() rechaza y rompe la navegación.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadForFreshChunks();
});

// Error Boundary: si algo falla al renderizar, mostramos una tarjeta con salida
// (recargar / ir al inicio) en vez de dejar la pantalla en blanco.
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Chunk viejo tras deploy: recargar para traer los nuevos. Si ya recargamos
    // hace poco, seguimos al render normal y mostramos la tarjeta de error.
    if (isChunkLoadError(error) && reloadForFreshChunks()) return;
    console.error("AppErrorBoundary:", error, errorInfo);
    captureAppError(error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const isDev = import.meta.env.DEV;
      const isChunk = isChunkLoadError(this.state.error);
      const btn: React.CSSProperties = {
        fontFamily: "inherit",
        fontSize: "0.9rem",
        fontWeight: 600,
        padding: "0.6rem 1.1rem",
        borderRadius: "8px",
        cursor: "pointer",
        border: "1px solid transparent",
      };
      return (
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            maxWidth: "560px",
            margin: "2rem auto",
            background: "#1e293b",
            color: "#e2e8f0",
            borderRadius: "12px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
          }}
        >
          <h1 style={{ color: "#f87171", marginTop: 0 }}>
            {isChunk ? "Hay una versión nueva disponible" : "Error en la aplicación"}
          </h1>
          <p>
            {isChunk
              ? "Se actualizó la aplicación mientras la tenías abierta. Recargá para continuar donde estabas."
              : "Ocurrió un error inesperado. Recargá la página; si persiste, avisá al soporte."}
          </p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ ...btn, background: "#3b82f6", color: "#fff" }}
            >
              Recargar página
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/app")}
              style={{ ...btn, background: "transparent", color: "#e2e8f0", borderColor: "#475569" }}
            >
              Ir al inicio
            </button>
          </div>
          {isDev && (
            <>
              <pre
                style={{
                  background: "#0f172a",
                  padding: "1rem",
                  borderRadius: "8px",
                  overflow: "auto",
                  fontSize: "0.8rem",
                  marginTop: "1.25rem",
                }}
              >
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
              <p>Abre la consola del navegador (F12) para más detalles.</p>
            </>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// Comprobar variables de entorno ANTES de cargar App (evita pantalla negra si falta .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function showErrorInRoot(title: string, message: string, detail?: string) {
  const root = document.getElementById("root");
  if (!root) return;
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 560px; margin: 2rem auto; background: #1e293b; color: #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
      <h1 style="color: #f87171; margin-top: 0;">${escape(title)}</h1>
      <p>${escape(message)}</p>
      ${detail ? `<pre style="background: #0f172a; padding: 1rem; border-radius: 8px; overflow: auto; font-size: 0.8rem; white-space: pre-wrap;">${escape(detail)}</pre>` : ""}
      <p>Abre la consola del navegador (F12) para más detalles.</p>
    </div>
  `;
}

if (supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    const origin = url.origin;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch {
    // ignore invalid URL
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  showErrorInRoot(
    "Configuración requerida",
    "Faltan variables de entorno de Supabase. Crea un archivo <strong>.env</strong> en la raíz del proyecto (junto a package.json) con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Puedes copiar <strong>.env.example</strong> a <strong>.env</strong> y rellenar los valores. Luego reinicia npm run dev."
  );
} else {
  initObservability();
  setupPerformanceObservers();
  // Registra el service worker (autoUpdate). Habilita instalación PWA y push.
  registerSW({ immediate: true });
  import("./index.css");
  Promise.all([
    import("react-dom/client"),
    import("./App.tsx"),
  ])
    .then(([{ createRoot }, { default: App }]) => {
      const root = document.getElementById("root");
      if (!root) {
        showErrorInRoot("Error", "No se encontró el elemento #root en el HTML.");
        return;
      }
      createRoot(root).render(
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      );
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      showErrorInRoot(
        "Error al cargar la aplicación",
        "Algo falló antes de mostrar la app. Suele ser por variables de entorno (.env) o por un error en un módulo.",
        stack ?? message
      );
      console.error("Bootstrap error:", err);
    });
}
