import "@testing-library/jest-dom";
import { vi } from "vitest";

// Stubs de env vars de Supabase para que los módulos que importan @/lib/supabase
// no tiren al arrancar en entorno de test (CI no tiene .env). Los tests no hacen
// requests reales — usan funciones puras o mocks.
vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
