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

const CAN_DELETE = new Set(["admin", "jefe_jefe", "gerente", "jefe_sucursal"]);

type Body = {
  user_id?: string;
};

async function handler(req: Request): Promise<Response> {
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

  const targetId = (body.user_id ?? "").trim();
  if (!targetId) {
    return jsonResponse(400, { ok: false, error: "user_id requerido" });
  }

  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PROJECT_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    const missing = [
      !supabaseUrl && "SUPABASE_URL",
      !anonKey && "SUPABASE_ANON_KEY",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean).join(", ");
    console.error(`[vendor-user-delete] Missing env vars: ${missing}`);
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

  const callerRole = callerRow.role as string;
  if (!CAN_DELETE.has(callerRole)) {
    return jsonResponse(403, { ok: false, error: "Sin permiso para eliminar usuarios" });
  }

  if (callerRow.id === targetId) {
    return jsonResponse(403, { ok: false, error: "No puedes eliminar tu propia cuenta" });
  }

  const { data: targetRow, error: targetErr } = await admin
    .from("users")
    .select("id, email, role, tenant_id, branch_id, legacy_protected")
    .eq("id", targetId)
    .maybeSingle();

  if (targetErr || !targetRow) {
    return jsonResponse(404, { ok: false, error: "Usuario no encontrado" });
  }

  if (targetRow.tenant_id !== callerRow.tenant_id) {
    return jsonResponse(403, { ok: false, error: "Usuario no pertenece a tu organización" });
  }

  if (targetRow.legacy_protected) {
    return jsonResponse(403, { ok: false, error: "Esta cuenta está protegida y no puede eliminarse" });
  }

  if (targetRow.role !== "vendedor") {
    return jsonResponse(403, {
      ok: false,
      error: "Solo se pueden eliminar cuentas con rol vendedor desde esta pantalla",
    });
  }

  if (callerRole === "gerente" || callerRole === "jefe_sucursal") {
    if (!callerRow.branch_id || targetRow.branch_id !== callerRow.branch_id) {
      return jsonResponse(403, { ok: false, error: "Solo puedes eliminar vendedores de tu sucursal" });
    }
  }

  const email = (targetRow.email as string).trim().toLowerCase();
  await admin.from("pending_vendor_provisions").delete().eq("email", email);

  const { error: docErr } = await admin.from("documents").update({ created_by: null }).eq("created_by", targetId);
  if (docErr) {
    console.error("[vendor-user-delete] documents cleanup:", docErr.code, docErr.message);
    return jsonResponse(500, { ok: false, error: docErr.message || "No se pudo liberar referencias" });
  }

  const { error: authDelErr } = await admin.auth.admin.deleteUser(targetId);
  if (authDelErr) {
    console.error("[vendor-user-delete] auth.admin.deleteUser:", authDelErr.message);
    return jsonResponse(400, { ok: false, error: authDelErr.message || "No se pudo eliminar la sesión de acceso" });
  }

  const { error: pubErr } = await admin.from("users").delete().eq("id", targetId);
  if (pubErr) {
    console.error("[vendor-user-delete] public.users delete:", pubErr.code, pubErr.message);
    return jsonResponse(500, { ok: false, error: pubErr.message || "Acceso eliminado pero falló limpiar el perfil" });
  }

  return jsonResponse(200, { ok: true, user_id: targetId });
}

Deno.serve((req) => handler(req));
