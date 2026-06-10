import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type KeyResolution =
  | { kind: "env"; branchId: string }
  | { kind: "db"; branchId: string; keyRowId: string };

export function isProductionEnv(): boolean {
  const vercelEnv = (process.env.VERCEL_ENV ?? "").toLowerCase();
  if (vercelEnv) return vercelEnv === "production";
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

export async function resolveIngestKey(
  supabase: SupabaseClient,
  providedKey: string,
  bodyBranchId: string | undefined,
  envKey: string | undefined,
): Promise<
  | { ok: true; resolution: KeyResolution }
  | { ok: false; status: number; error: string }
> {
  if (envKey && providedKey === envKey && !isProductionEnv()) {
    const bid = bodyBranchId?.trim();
    if (!bid) {
      return {
        ok: false,
        status: 400,
        error: "branch_id is required when using the global N8N_LEAD_INGEST_API_KEY",
      };
    }
    return { ok: true, resolution: { kind: "env", branchId: bid } };
  }

  const secretHash = createHash("sha256").update(providedKey, "utf8").digest("hex");

  const { data: row, error } = await supabase
    .from("lead_ingest_keys")
    .select("id, branch_id")
    .eq("secret_hash", secretHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("[ingest] resolveIngestKey:", error);
    return { ok: false, status: 500, error: "Internal error resolving API key" };
  }
  if (!row) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const bodyBid = bodyBranchId?.trim();
  if (bodyBid && bodyBid !== row.branch_id) {
    return {
      ok: false,
      status: 403,
      error: "branch_id does not match this API key",
    };
  }

  void supabase
    .from("lead_ingest_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    ok: true,
    resolution: { kind: "db", branchId: row.branch_id, keyRowId: row.id },
  };
}

export function getIngestAllowedOrigin(originHeader: string | undefined): string {
  const raw = (process.env.LEAD_INGEST_ALLOWED_ORIGINS ?? "").trim();
  if (!raw) return "*";
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = originHeader?.trim() ?? "";
  return origin && allowed.includes(origin) ? origin : allowed[0];
}
