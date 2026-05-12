import { supabase } from "@/lib/supabase";

export type AiCostTotals = {
  call_count: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
};

export type AiCostByTenant = {
  tenant_id: string;
  call_count: number;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
};

export type AiCostByFeature = {
  feature: string;
  call_count: number;
  cost_usd: number;
};

export type AiCostByModel = {
  model: string;
  call_count: number;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
};

export type AiCostByDay = {
  day: string;
  call_count: number;
  cost_usd: number;
};

export type AiCostSummary =
  | {
      authorized: true;
      range: { from: string; to: string };
      totals: AiCostTotals;
      by_tenant: AiCostByTenant[];
      by_feature: AiCostByFeature[];
      by_model: AiCostByModel[];
      by_day: AiCostByDay[];
    }
  | { authorized: false; error: string };

/**
 * Llama a la RPC super_admin_ai_cost_summary que devuelve agregados de uso/costo
 * de AI. Sólo retorna datos si el JWT pertenece a hessen@test.io; la propia RPC
 * valida el email y devuelve {authorized: false} para cualquier otro usuario.
 */
export async function getAiCostSummary(
  from: string,
  to: string,
): Promise<AiCostSummary> {
  const { data, error } = await supabase.rpc("super_admin_ai_cost_summary", {
    p_from: from,
    p_to: to,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data as AiCostSummary;
}
