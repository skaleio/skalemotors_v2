import { supabase } from "../supabase";

export type MetaAdsStatus = {
  connected: boolean;
  ad_account_id: string | null;
};

export type MetaAdsCampaign = {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  start_time?: string;
  end_time?: string;
};

export type MetaAdsInsight = {
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  date_start?: string;
  date_stop?: string;
  [key: string]: unknown;
};

/** Comprobar si Meta Ads está conectado para la sucursal (sin exponer token). */
export async function getMetaAdsStatus(branchId: string): Promise<MetaAdsStatus> {
  const { data, error } = await supabase.functions.invoke<MetaAdsStatus>("meta-ads-status", {
    body: { branch_id: branchId },
  });
  if (error) throw error;
  if (data && "connected" in data) return data;
  return { connected: false, ad_account_id: null };
}

/** Conectar Meta Ads: guarda token y opcionalmente ad_account_id vía Edge Function. */
export async function connectMetaAds(
  branchId: string,
  params: { accessToken: string; adAccountId?: string }
): Promise<{ ok: true; message: string; ad_account_id?: string | null }> {
  const { data, error } = await supabase.functions.invoke("meta-ads-connect", {
    body: {
      branch_id: branchId,
      access_token: params.accessToken,
      ad_account_id: params.adAccountId?.trim() || undefined,
    },
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al conectar Meta Ads");
  }
  return data as { ok: true; message: string; ad_account_id?: string | null };
}

/** Desconectar Meta Ads para la sucursal. */
export async function disconnectMetaAds(branchId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("meta-ads-disconnect", {
    body: { branch_id: branchId },
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al desconectar");
  }
}

/** Listar campañas de Meta Ads de la sucursal. */
export async function getMetaAdsCampaigns(branchId: string): Promise<{
  campaigns: MetaAdsCampaign[];
  paging: unknown;
}> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; campaigns?: MetaAdsCampaign[]; paging?: unknown; error?: string }>(
    "meta-ads-campaigns",
    { body: { branch_id: branchId } }
  );
  if (error) throw error;
  if (data && !data.ok) {
    throw new Error(data.error ?? "Error al obtener campañas");
  }
  return {
    campaigns: (data?.campaigns ?? []) as MetaAdsCampaign[],
    paging: data?.paging ?? null,
  };
}

/** Obtener insights (métricas) de Meta Ads: cuenta o campaña, con rango de fechas. */
export async function getMetaAdsInsights(
  branchId: string,
  options?: {
    campaignId?: string;
    datePreset?: string;
    timeRange?: { since: string; until: string };
  }
): Promise<{ insights: MetaAdsInsight[]; paging: unknown }> {
  const body: Record<string, unknown> = { branch_id: branchId };
  if (options?.campaignId) body.campaign_id = options.campaignId;
  if (options?.datePreset) body.date_preset = options.datePreset;
  if (options?.timeRange) body.time_range = options.timeRange;

  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    insights?: MetaAdsInsight[];
    paging?: unknown;
    error?: string;
  }>("meta-ads-insights", { body });
  if (error) throw error;
  if (data && !data.ok) {
    throw new Error(data.error ?? "Error al obtener métricas");
  }
  return {
    insights: (data?.insights ?? []) as MetaAdsInsight[],
    paging: data?.paging ?? null,
  };
}
