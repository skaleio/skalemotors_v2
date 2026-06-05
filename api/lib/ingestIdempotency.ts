import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadIdempotentResponse(
  supabase: SupabaseClient,
  branchId: string,
  idempotencyKey: string,
): Promise<{ status_code: number; response_body: unknown } | null> {
  const { data, error } = await supabase
    .from("lead_ingest_idempotency")
    .select("status_code, response_body")
    .eq("branch_id", branchId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) {
    console.error("[ingest] idempotency load:", error);
    return null;
  }
  return data ?? null;
}

export async function storeIdempotentResponse(
  supabase: SupabaseClient,
  branchId: string,
  idempotencyKey: string,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  const { error } = await supabase.from("lead_ingest_idempotency").upsert(
    {
      branch_id: branchId,
      idempotency_key: idempotencyKey,
      status_code: statusCode,
      response_body: responseBody,
    },
    { onConflict: "branch_id,idempotency_key" },
  );
  if (error) {
    console.error("[ingest] idempotency store:", error);
  }
}
