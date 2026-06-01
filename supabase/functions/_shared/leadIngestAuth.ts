import { isProductionEnv } from "./env.ts";

export function extractApiKey(req: Request): string {
  return (
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(req.url).searchParams.get("api_key") ||
    ""
  ).trim();
}

/** Valida key per-branch vía RPC verify_lead_ingest_key (service role). */
export async function verifyLeadIngestKeyForBranch(
  supabaseUrl: string,
  serviceRoleKey: string,
  providedKey: string,
  branchId: string,
): Promise<boolean> {
  if (!providedKey || !branchId) return false;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_lead_ingest_key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ p_key: providedKey, p_branch_id: branchId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean } | null;
    return json?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Auth para lead-create, lead-state-update, pending-task-create.
 * 1) verify_lead_ingest_key (prod + dev)
 * 2) fallback env legacy key solo fuera de producción
 */
export async function resolveLeadAutomationAuth(
  req: Request,
  branchId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  legacyEnvNames: string[],
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const provided = extractApiKey(req);
  if (!provided) {
    return { ok: false, status: 401, error: "Missing API key" };
  }

  const perBranch = await verifyLeadIngestKeyForBranch(
    supabaseUrl,
    serviceRoleKey,
    provided,
    branchId,
  );
  if (perBranch) return { ok: true };

  if (isProductionEnv()) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  for (const name of legacyEnvNames) {
    const legacy = Deno.env.get(name)?.trim();
    if (legacy && provided.includes(legacy)) {
      return { ok: true };
    }
  }

  return { ok: false, status: 401, error: "Invalid API key" };
}
