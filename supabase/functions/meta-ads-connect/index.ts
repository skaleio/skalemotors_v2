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

type ConnectBody = {
  branch_id: string;
  access_token: string;
  ad_account_id?: string;
};

function isPlaceholderAdAccountId(value: string): boolean {
  const v = value.replace(/^act_/, "").trim();
  return v === "" || v === "123456789";
}

async function validateMetaAdsToken(
  accessToken: string,
  adAccountId?: string
): Promise<{ ok: boolean; error?: string; ad_account_id?: string | null }> {
  const base = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
  const tokenParam = `access_token=${encodeURIComponent(accessToken)}`;

  if (adAccountId && !isPlaceholderAdAccountId(adAccountId)) {
    const id = adAccountId.replace(/^act_/, "").trim();
    const url = `${base}/act_${id}?fields=id,name,account_id&${tokenParam}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: (err as { error?: { message?: string } })?.error?.message || res.statusText };
    }
    return { ok: true, ad_account_id: `act_${id}` };
  }

  const meUrl = `${base}/me?fields=id&${tokenParam}`;
  const meRes = await fetch(meUrl);
  if (!meRes.ok) {
    const err = await meRes.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: { message?: string } })?.error?.message || "Token inválido o expirado." };
  }

  const url = `${base}/me/adaccounts?fields=id,name,account_id&${tokenParam}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: { message?: string } })?.error?.message || res.statusText };
  }
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  const first = data.data?.[0];
  if (first) {
    return { ok: true, ad_account_id: first.id };
  }
  return { ok: true, ad_account_id: null };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Missing auth" });
  }

  let body: ConnectBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const branchId = (body.branch_id ?? "").trim();
  if (!branchId) return jsonResponse(400, { ok: false, error: "branch_id is required" });

  const accessToken = (body.access_token ?? "").trim();
  if (!accessToken) return jsonResponse(400, { ok: false, error: "access_token is required" });

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
  if (userBranchId !== branchId) {
    return jsonResponse(403, { ok: false, error: "branch_id does not match your user branch" });
  }

  let adAccountIdInput = (body.ad_account_id ?? "").trim() || undefined;
  if (adAccountIdInput && isPlaceholderAdAccountId(adAccountIdInput)) adAccountIdInput = undefined;
  const validation = await validateMetaAdsToken(accessToken, adAccountIdInput);
  if (!validation.ok) {
    return jsonResponse(400, { ok: false, error: validation.error || "Invalid Meta Ads token" });
  }

  const adAccountId = validation.ad_account_id ?? (adAccountIdInput && !isPlaceholderAdAccountId(adAccountIdInput) ? adAccountIdInput : null);

  const { error: upsertErr } = await admin.from("meta_ads_connections").upsert(
    {
      branch_id: branchId,
      access_token: accessToken,
      ad_account_id: adAccountId,
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "branch_id" }
  );

  if (upsertErr) {
    return jsonResponse(500, { ok: false, error: upsertErr.message });
  }

  return jsonResponse(200, { ok: true, message: "Meta Ads conectado correctamente", ad_account_id: adAccountId });
}
