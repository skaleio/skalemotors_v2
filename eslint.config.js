import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "**/.venv/**",
      "services/**",
      "supabase/**",
      "api/**",
      // Archivo generado de Supabase, regenerable con `supabase gen types typescript`.
      "src/lib/types/database.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    // Solo app React: evita lintear edge functions (Deno) y dependencias vendor (.venv).
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Deuda técnica del monolito: warning para no bloquear CI SaaS; ir endureciendo por módulo.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      // eslint-plugin-react-hooks v7 trae las reglas del React Compiler como error.
      // El monolito preexistente las viola en masa; degradadas a warning para no bloquear
      // el CI. rules-of-hooks se mantiene en error. Endurecer por modulo al editarlo.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
    },
  },
);
