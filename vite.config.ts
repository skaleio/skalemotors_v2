import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseTarget = (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");

  return {
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react/")) return "react-vendor";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("recharts")) return "recharts";
            if (id.includes("react-router") || id.includes("react-router-dom")) return "router";
            if (id.includes("lucide-react")) return "lucide";
            if (id.includes("@radix-ui")) return "radix";
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: "0.0.0.0", // Accesible en la red (localhost + IP de la máquina)
    port: 8085,
    historyApiFallback: true,
    // Por defecto CORS solo permite localhost/127.0.0.1; al abrir por IP (ej. 192.168.1.27) el navegador bloquea sin esto
    cors: true,
    proxy: supabaseTarget
      ? {
          "/api/edge": {
            target: supabaseTarget,
            changeOrigin: true,
            secure: true,
            rewrite: (p) => p.replace(/^\/api\/edge/, "/functions/v1"),
          },
        }
      : undefined,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Una sola copia de React; duplicados provocan "Should have a queue" en hooks.
    dedupe: ["react", "react-dom"],
  },
};
});
