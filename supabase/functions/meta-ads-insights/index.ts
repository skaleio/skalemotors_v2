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

type InsightsBody = {
  branch_id?: string;
  campaign_id?: string;
  date_preset?: string;
  time_range?: { since: string; until: string };
};

function buildInsightsUrl(
  accessToken: string,
  level: "account" | "campaign",
  id: string,
  options: InsightsBody
): string {
  const fields = "impressions,clicks,spend,ctr,cpc,cpm,reach,frequency,actions,action_values";
  const params = new URLSearchParams({
    fields,
    access_token: accessToken,
  });
  if (options.date_preset) {
    params.set("date_preset", options.date_preset);
  } else if (options.time_range?.since && options.time_range?.until) {
    params.set("time_range", JSON.stringify({ since: options.time_range.since, until: options.time_range.until }));
  } else {
    params.set("date_preset", "last_30d");
  }
  const base = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
  const path = level === "campaign" ? `${options.campaign_id}/insights` : `${id}/insights`;
  return `${base}/${path}?${params.toString()}`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Missing auth" });
  }

  let body: InsightsBody = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
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
  const targetBranchId = (body.branch_id ?? "").trim() || userBranchId;
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
  const adAccountId = (conn.ad_account_id as string) ?? "";
  if (!adAccountId) {
    return jsonResponse(200, { ok: true, insights: [], paging: null });
  }

  const campaignId = (body.campaign_id ?? "").trim() || null;
  const level: "account" | "campaign" = campaignId ? "campaign" : "account";
  const id = campaignId || adAccountId;

  const url = buildInsightsUrl(token, level, adAccountId, { ...body, campaign_id: campaignId ?? undefined });
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
  return jsonResponse(200, { ok: true, insights: data.data ?? [], paging: data.paging ?? null });
}
