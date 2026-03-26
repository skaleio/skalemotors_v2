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
    },
  },
);
