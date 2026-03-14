/// <reference path="../_shared/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildBranchBrain } from "../_shared/brainBuilder.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Refresca el cerebro de una sucursal o de todas.
 * Llamar por cron cada 15 min o on-demand.
 * Body opcional: { branchId?: string }. Si no se envía branchId, refresca todas las sucursales.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(500, { ok: false, error: "Supabase no configurado" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let branchIds: string[] = [];
  try {
    const body = req.body ? await req.json().catch(() => ({})) : {};
    const branchId = body.branchId as string | undefined;
    if (branchId) {
      branchIds = [branchId];
    } else {
      const { data: branches } = await supabase.from("branches").select("id");
      branchIds = (branches ?? []).map((b: any) => b.id).filter(Boolean);
    }
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid body" });
  }

  let refreshed = 0;
  for (const bid of branchIds) {
    try {
      const snapshotText = await buildBranchBrain(supabase, bid);
      const { error } = await supabase.from("ai_branch_brain").upsert(
        {
          branch_id: bid,
          snapshot_text: snapshotText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "branch_id" }
      );
      if (!error) refreshed++;
    } catch (e) {
      console.error("[ai-brain-refresh] branch", bid, e);
    }
  }

  return jsonResponse(200, { ok: true, refreshed, total: branchIds.length });
}
