// Helper para registrar uso de AI en la tabla ai_usage_logs.
// Cada AI Edge Function (ai-chat, ai-generate, studio-ia-generate, support-chat)
// debe llamar logAiUsage() después de cada call exitosa al provider.
// Fallos del logging son silenciados — el monitor es secundario al flujo principal.

type LogParams = {
  supabaseUrl: string;
  serviceRoleKey: string;
  tenantId: string | null | undefined;
  userId?: string | null;
  branchId?: string | null;
  feature: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
};

export async function logAiUsage(params: LogParams): Promise<void> {
  if (!params.tenantId || !params.feature || !params.model) {
    return;
  }
  try {
    await fetch(`${params.supabaseUrl}/rest/v1/ai_usage_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": params.serviceRoleKey,
        "Authorization": `Bearer ${params.serviceRoleKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        tenant_id: params.tenantId,
        user_id: params.userId ?? null,
        branch_id: params.branchId ?? null,
        feature: params.feature,
        model: params.model,
        tokens_input: params.tokensInput,
        tokens_output: params.tokensOutput,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Silenciar — el logging no debe interrumpir la respuesta al cliente.
  }
}
