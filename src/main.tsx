import React from "react";

// Error Boundary: si algo falla al renderizar, mostramos el error en vez de pantalla negra
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AppErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
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
          <h1 style={{ color: "#f87171", marginTop: 0 }}>Error en la aplicación</h1>
          <p>{this.state.error.message}</p>
          <pre
            style={{
              background: "#0f172a",
              padding: "1rem",
              borderRadius: "8px",
              overflow: "auto",
              fontSize: "0.8rem",
            }}
          >
            {this.state.error.stack}
          </pre>
          <p>Abre la consola del navegador (F12) para más detalles.</p>
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
  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 560px; margin: 2rem auto; background: #1e293b; color: #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
      <h1 style="color: #f87171; margin-top: 0;">${title}</h1>
      <p>${message}</p>
      ${detail ? `<pre style="background: #0f172a; padding: 1rem; border-radius: 8px; overflow: auto; font-size: 0.8rem; white-space: pre-wrap;">${detail.replace(/</g, "&lt;")}</pre>` : ""}
      <p>Abre la consola del navegador (F12) para más detalles.</p>
    </div>
  `;
}

if (!supabaseUrl || !supabaseAnonKey) {
  showErrorInRoot(
    "Configuración requerida",
    "Faltan variables de entorno de Supabase. Crea un archivo <strong>.env</strong> en la raíz del proyecto (junto a package.json) con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Puedes copiar env.example a .env y rellenar los valores. Luego reinicia npm run dev."
  );
} else {
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
