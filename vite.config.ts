import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // autoUpdate: el SW se actualiza solo (sin prompt). injectRegister null:
      // NO inyectamos el script de registro del plugin — lo registramos a mano
      // en src/main.tsx con registerSW(), que respeta este registerType.
      registerType: "autoUpdate",
      injectRegister: null,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "Skale Motors",
        short_name: "Skale",
        description: "Ecosistema automotriz: CRM, inventario, ventas y citas para tu automotora.",
        lang: "es-CL",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/app",
        scope: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Una sola copia de React; duplicados provocan "Should have a queue" en hooks.
    dedupe: ["react", "react-dom"],
  },
};
});
