import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // quitar comillas simples/dobles si vienen
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // No sobre-escribir env ya seteadas
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function main() {
  // Cargar .env / .env.local si existen (Node no lo hace por defecto)
  const cwd = process.cwd();
  loadDotEnvFile(path.join(cwd, ".env.local"));
  loadDotEnvFile(path.join(cwd, ".env"));

  // Compat: si el usuario solo configuró variables VITE_ (frontend),
  // reutilizamos la URL para scripts.
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }
  // Compat: algunos la nombran distinto
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const email = arg("email");
  const password = arg("password");
  const fullName = arg("full-name", "Hessen");
  const role = arg("role", "admin");
  const branchId = arg("branch-id", "550e8400-e29b-41d4-a716-446655440000"); // Providencia (según esquema)

  if (!email || !password) {
    throw new Error(
      "Uso: node scripts/create_user.mjs --email hessen@test.io --password hessen2026 [--full-name \"Hessen\"] [--role admin] [--branch-id <uuid>]",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`🚀 Creando usuario: ${email}`);

  // 1) Crear usuario en auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (authError) {
    // Si ya existe, intentamos actualizar password
    if (String(authError.message || "").toLowerCase().includes("already registered")) {
      console.log("ℹ️ El usuario ya existe en Auth. Intentando actualizar contraseña…");
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
      if (listErr) throw listErr;
      const existing = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) throw authError;

      const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: { full_name: fullName, role },
      });
      if (updErr) throw updErr;
      console.log("✅ Password actualizado en Auth:", existing.id);

      // Continuar con id existente
      await ensurePublicUserRow(supabase, existing.id, email, fullName, role, branchId);
      return;
    }
    throw authError;
  }

  const userId = authData?.user?.id;
  if (!userId) throw new Error("No se recibió userId desde Supabase Auth");
  console.log("✅ Usuario creado en Auth:", userId);

  // 2) Asegurar fila en public.users (por si no hay trigger)
  await ensurePublicUserRow(supabase, userId, email, fullName, role, branchId);
}

async function ensurePublicUserRow(supabase, userId, email, fullName, role, branchId) {
  const { data: existing, error: selErr } = await supabase
    .from("users")
    .select("id, email, role, branch_id")
    .eq("id", userId)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing?.id) {
    console.log("✅ Ya existe en public.users:", existing);
    // Asegurar rol/sucursal
    const { error: updErr } = await supabase
      .from("users")
      .update({
        email,
        full_name: fullName,
        role,
        branch_id: branchId,
        is_active: true,
      })
      .eq("id", userId);
    if (updErr) throw updErr;
    console.log("✅ Perfil actualizado en public.users");
    return;
  }

  const { error: insErr } = await supabase.from("users").insert({
    id: userId,
    email,
    full_name: fullName,
    phone: null,
    role,
    branch_id: branchId,
    is_active: true,
    onboarding_completed: true,
  });

  if (insErr) throw insErr;
  console.log("✅ Perfil creado en public.users");
}

main().catch((err) => {
  console.error("❌ Error:", err?.message || err);
  process.exit(1);
});


