import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";

export type ZernioAuthContext = {
  userId: string;
  tenantId: string;
  role: string;
  branchId: string | null;
  userClient: SupabaseClient;
  admin: SupabaseClient;
};

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

function authErrorResponse(req: Request, status: number, error: string): Response {
  const cors = getCorsHeaders(req);
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function requireZernioAuth(req: Request): Promise<ZernioAuthContext | Response> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return authErrorResponse(req, 401, "Missing auth");
  }

  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PROJECT_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return authErrorResponse(req, 500, "Missing Supabase env vars");
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return authErrorResponse(req, 401, "Invalid auth");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: profile, error: profileErr } = await admin
    .from("users")
    .select("id, tenant_id, branch_id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileErr || !profile?.tenant_id) {
    return authErrorResponse(req, 403, "Perfil de usuario no encontrado");
  }

  return {
    userId: userData.user.id,
    tenantId: profile.tenant_id,
    role: profile.role ?? "vendedor",
    branchId: profile.branch_id ?? null,
    userClient,
    admin,
  };
}
