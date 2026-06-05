import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { LANDING_BRANCH_ID } from "./landingBookingHandler";

function isProductionEnv(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export async function resolveLandingIngestKey(
  supabase: SupabaseClient,
  providedKey: string,
  bodyBranchId?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const envKeys = [
    process.env.BOOKING_INGEST_API_KEY?.trim(),
    process.env.N8N_LEAD_INGEST_API_KEY?.trim(),
  ].filter(Boolean) as string[];

  if (!isProductionEnv() && envKeys.some((k) => k === providedKey)) {
    const bid = bodyBranchId?.trim();
    if (bid && bid !== LANDING_BRANCH_ID) {
      return { ok: false, status: 403, error: "branch_id does not match landing branch" };
    }
    return { ok: true };
  }

  const secretHash = createHash("sha256").update(providedKey, "utf8").digest("hex");
  const { data: row, error } = await supabase
    .from("lead_ingest_keys")
    .select("id, branch_id")
    .eq("secret_hash", secretHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("[landing-booking] resolve key:", error);
    return { ok: false, status: 500, error: "Internal error resolving API key" };
  }
  if (!row) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }
  if (row.branch_id !== LANDING_BRANCH_ID) {
    return { ok: false, status: 403, error: "This API key is not valid for landing booking" };
  }

  const bodyBid = bodyBranchId?.trim();
  if (bodyBid && bodyBid !== LANDING_BRANCH_ID) {
    return { ok: false, status: 403, error: "branch_id does not match this API key" };
  }

  void supabase
    .from("lead_ingest_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true };
}
