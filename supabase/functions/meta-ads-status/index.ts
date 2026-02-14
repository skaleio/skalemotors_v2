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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Missing auth" });
  }

  let branchId: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      branchId = (body.branch_id ?? "").trim() || null;
    } catch {
      return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
    }
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

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("users").select("id, branch_id").eq("id", userData.user.id).maybeSingle();
  const userBranchId = profile?.branch_id ?? null;

  const targetBranchId = branchId || userBranchId;
  if (!targetBranchId) {
    return jsonResponse(200, { connected: false, ad_account_id: null });
  }

  if (userBranchId !== targetBranchId && profile?.role !== "admin") {
    return jsonResponse(403, { ok: false, error: "branch_id does not match your user branch" });
  }

  const { data: row } = await admin
    .from("meta_ads_connections")
    .select("id, ad_account_id, status")
    .eq("branch_id", targetBranchId)
    .maybeSingle();

  if (!row || row.status !== "active") {
    return jsonResponse(200, { connected: false, ad_account_id: null });
  }

  return jsonResponse(200, { connected: true, ad_account_id: row.ad_account_id ?? null });
}
