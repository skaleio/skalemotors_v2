import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const META_GRAPH_VERSION = "v21.0";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

async function getConnectionAndAdAccount(
  admin: ReturnType<typeof createClient>,
  branchId: string,
  accessToken: string
): Promise<string> {
  const { data: row } = await admin
    .from("meta_ads_connections")
    .select("ad_account_id")
    .eq("branch_id", branchId)
    .single();
  if (row?.ad_account_id) return row.ad_account_id;
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/me/adaccounts?fields=id&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo obtener la cuenta de anuncios");
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  const first = data.data?.[0];
  if (!first) throw new Error("No se encontró ninguna cuenta de anuncios");
  return first.id;
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
  const { data: profile } = await admin.from("users").select("id, branch_id, role").eq("id", userData.user.id).maybeSingle();
  const userBranchId = profile?.branch_id ?? null;
  const targetBranchId = branchId || userBranchId;
  if (!targetBranchId) {
    return jsonResponse(400, { ok: false, error: "branch_id is required" });
  }
  if (userBranchId !== targetBranchId && profile?.role !== "admin") {
    return jsonResponse(403, { ok: false, error: "branch_id does not match your user branch" });
  }

  const { data: conn, error: connErr } = await admin
    .from("meta_ads_connections")
    .select("access_token, ad_account_id")
    .eq("branch_id", targetBranchId)
    .eq("status", "active")
    .maybeSingle();

  if (connErr || !conn) {
    return jsonResponse(404, { ok: false, error: "Meta Ads no conectado para esta sucursal. Conecta en Integraciones." });
  }

  const token = conn.access_token as string;
  let adAccountId = (conn.ad_account_id as string) ?? null;
  if (!adAccountId) {
    try {
      adAccountId = await getConnectionAndAdAccount(admin, targetBranchId, token);
    } catch {
      return jsonResponse(200, { ok: true, campaigns: [], paging: null });
    }
  }

  const fields = "id,name,status,objective,daily_budget,lifetime_budget,created_time,start_time,end_time";
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${adAccountId}/campaigns?fields=${fields}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } })?.error?.message || res.statusText;
    await admin
      .from("meta_ads_connections")
      .update({ last_error: msg, status: "error", updated_at: new Date().toISOString() })
      .eq("branch_id", targetBranchId);
    return jsonResponse(502, { ok: false, error: msg });
  }

  const data = (await res.json()) as { data?: unknown[]; paging?: unknown };
  return jsonResponse(200, { ok: true, campaigns: data.data ?? [], paging: data.paging ?? null });
}
