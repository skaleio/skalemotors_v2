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
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { ok: false, error: "Missing auth" });
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
  const branchId = profile?.branch_id ?? null;
  if (!branchId) {
    return jsonResponse(400, { ok: false, error: "User has no branch" });
  }

  const { data: connections } = await admin
    .from("marketplace_connections")
    .select("id, platform, credentials")
    .eq("branch_id", branchId)
    .eq("status", "active");

  if (!connections?.length) {
    return jsonResponse(200, { ok: true, synced: 0, message: "No active connections to sync" });
  }

  const { data: vehicles } = await admin
    .from("vehicles")
    .select("id, branch_id, make, model, year, color, mileage, price, description, images, status, category, condition, fuel_type, transmission")
    .eq("branch_id", branchId)
    .eq("status", "disponible");

  if (!vehicles?.length) {
    return jsonResponse(200, { ok: true, synced: 0, message: "No available vehicles to sync" });
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "") + "/functions/v1";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let synced = 0;
  const errors: { vehicle_id: string; platform: string; error: string }[] = [];

  for (const conn of connections) {
    for (const v of vehicles) {
      try {
        const res = await fetch(`${baseUrl}/marketplace-publish`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ vehicle_id: v.id, platform: conn.platform }),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.ok) synced++;
        else if (data?.error) errors.push({ vehicle_id: v.id, platform: conn.platform, error: data.error });
      } catch (e) {
        errors.push({
          vehicle_id: v.id,
          platform: conn.platform,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return jsonResponse(200, {
    ok: true,
    synced,
    total_attempts: (connections?.length ?? 0) * (vehicles?.length ?? 0),
    errors: errors.length ? errors : undefined,
  });
}
