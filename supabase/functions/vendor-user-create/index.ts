import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

const CAN_CREATE = new Set(["admin", "jefe_jefe", "gerente", "jefe_sucursal"]);

type Body = {
  email?: string;
  password?: string;
  full_name?: string;
  branch_id?: string | null;
};

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Missing auth" });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  const password = (body.password ?? "").trim();
  const fullName = (body.full_name ?? "").trim();
  const branchId = (body.branch_id ?? "").trim();

  if (!email || !email.includes("@")) {
    return jsonResponse(400, { ok: false, error: "email inválido" });
  }
  if (password.length < 8) {
    return jsonResponse(400, { ok: false, error: "La contraseña debe tener al menos 8 caracteres" });
  }
  if (!fullName) {
    return jsonResponse(400, { ok: false, error: "Nombre requerido" });
  }
  if (!branchId) {
    return jsonResponse(400, { ok: false, error: "Sucursal requerida" });
  }

  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PROJECT_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse(401, { ok: false, error: "Invalid auth" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerRow, error: callerErr } = await admin
    .from("users")
    .select("id, role, tenant_id, branch_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (callerErr || !callerRow?.tenant_id) {
    return jsonResponse(403, { ok: false, error: "Sin tenant asignado" });
  }

  const role = callerRow.role as string;
  if (!CAN_CREATE.has(role)) {
    return jsonResponse(403, { ok: false, error: "Sin permiso para crear vendedores" });
  }

  if (role === "gerente" || role === "jefe_sucursal") {
    if (!callerRow.branch_id || callerRow.branch_id !== branchId) {
      return jsonResponse(403, { ok: false, error: "Solo puedes crear vendedores en tu sucursal" });
    }
  }

  const { data: branchRow, error: branchErr } = await admin
    .from("branches")
    .select("id, tenant_id")
    .eq("id", branchId)
    .maybeSingle();

  if (branchErr || !branchRow || branchRow.tenant_id !== callerRow.tenant_id) {
    return jsonResponse(400, { ok: false, error: "Sucursal no válida para tu organización" });
  }

  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("tenant_id", callerRow.tenant_id)
    .ilike("email", email)
    .maybeSingle();

  if (existingUser) {
    return jsonResponse(409, { ok: false, error: "Ya existe un usuario con ese correo en tu equipo" });
  }

  await admin.from("pending_vendor_provisions").delete().eq("email", email);

  const { error: pendErr } = await admin.from("pending_vendor_provisions").insert({
    email,
    tenant_id: callerRow.tenant_id,
    branch_id: branchId,
    role: "vendedor",
  });

  if (pendErr) {
    return jsonResponse(500, { ok: false, error: pendErr.message || "No se pudo preparar el alta" });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "vendedor" },
    app_metadata: { role: "vendedor" },
  });

  if (createErr || !created?.user?.id) {
    await admin.from("pending_vendor_provisions").delete().eq("email", email);
    const msg = createErr?.message ?? "No se pudo crear el usuario";
    if (msg.toLowerCase().includes("already")) {
      return jsonResponse(409, { ok: false, error: "Ese correo ya está registrado en el sistema de acceso" });
    }
    return jsonResponse(400, { ok: false, error: msg });
  }

  return jsonResponse(200, {
    ok: true,
    user_id: created.user.id,
    email,
  });
}
