import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AiBudgetCheck = {
  allowed: boolean;
  spent_usd?: number;
  budget_usd?: number;
};

export async function assertTenantAiBudget(
  supabase: SupabaseClient,
  tenantId: string | null | undefined,
): Promise<AiBudgetCheck> {
  if (!tenantId) {
    return { allowed: true };
  }
  const { data, error } = await supabase.rpc("check_tenant_ai_budget", {
    p_tenant_id: tenantId,
  });
  if (error || !data) {
    return { allowed: true };
  }
  const row = data as { allowed?: boolean; spent_usd?: number; budget_usd?: number };
  return {
    allowed: row.allowed !== false,
    spent_usd: row.spent_usd,
    budget_usd: row.budget_usd,
  };
}

export function aiBudgetExceededResponse(
  corsHeaders: Record<string, string>,
  check: AiBudgetCheck,
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Límite mensual de IA alcanzado para tu automotora. Contactá a soporte para ampliar el plan.",
      code: "AI_QUOTA_EXCEEDED",
      spent_usd: check.spent_usd,
      budget_usd: check.budget_usd,
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
