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

const PLATFORMS = ["mercadolibre", "facebook", "chileautos"] as const;
type Platform = (typeof PLATFORMS)[number];

type ConnectBody = {
  platform: Platform;
  branch_id: string;
  credentials: Record<string, string>;
};

async function validateMercadoLibre(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err || res.statusText };
  }
  return { ok: true };
}

async function validateFacebook(accessToken: string, catalogId?: string): Promise<{ ok: boolean; error?: string }> {
  const url = catalogId
    ? `https://graph.facebook.com/v18.0/${catalogId}?fields=id,name&access_token=${accessToken}`
    : `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${accessToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err || res.statusText };
  }
  return { ok: true };
}

async function validateChileAutos(clientId: string, clientSecret: string): Promise<{ ok: boolean; error?: string }> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch("https://id.s.core.csnglobal.net/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err || res.statusText };
  }
  return { ok: true };
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

  const platform = body.platform?.toLowerCase();
  if (!platform || !PLATFORMS.includes(platform as Platform)) {
    return jsonResponse(400, { ok: false, error: "platform must be mercadolibre, facebook or chileautos" });
  }
  const branchId = (body.branch_id ?? "").trim();
  if (!branchId) return jsonResponse(400, { ok: false, error: "branch_id is required" });

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

  const creds = body.credentials && typeof body.credentials === "object" ? body.credentials : {};

  if (platform === "mercadolibre") {
    const token = (creds.access_token ?? creds.accessToken ?? "").trim();
    if (!token) return jsonResponse(400, { ok: false, error: "credentials.access_token is required" });
    const v = await validateMercadoLibre(token);
    if (!v.ok) return jsonResponse(400, { ok: false, error: v.error || "Invalid Mercado Libre token" });
  } else if (platform === "facebook") {
    const token = (creds.access_token ?? creds.accessToken ?? "").trim();
    if (!token) return jsonResponse(400, { ok: false, error: "credentials.access_token is required" });
    const catalogId = (creds.catalog_id ?? creds.productCatalogId ?? "").trim() || undefined;
    const v = await validateFacebook(token, catalogId);
    if (!v.ok) return jsonResponse(400, { ok: false, error: v.error || "Invalid Facebook token" });
  } else if (platform === "chileautos") {
    const clientId = (creds.client_id ?? creds.clientId ?? "").trim();
    const clientSecret = (creds.client_secret ?? creds.clientSecret ?? "").trim();
    const sellerIdentifier = (creds.seller_identifier ?? creds.sellerIdentifier ?? "").trim();
    if (!clientId || !clientSecret) {
      return jsonResponse(400, { ok: false, error: "credentials.client_id and client_secret are required" });
    }
    const v = await validateChileAutos(clientId, clientSecret);
    if (!v.ok) return jsonResponse(400, { ok: false, error: v.error || "Invalid Chile Autos credentials" });
    if (!sellerIdentifier) {
      return jsonResponse(400, { ok: false, error: "credentials.seller_identifier is required" });
    }
  }

  const credentialsToStore: Record<string, string> = { ...creds };
  const { error: upsertErr } = await admin
    .from("marketplace_connections")
    .upsert(
      {
        branch_id: branchId,
        platform,
        credentials: credentialsToStore,
        status: "active",
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "branch_id,platform" }
    );

  if (upsertErr) {
    return jsonResponse(500, { ok: false, error: upsertErr.message });
  }

  return jsonResponse(200, { ok: true, message: "Connection saved" });
}
