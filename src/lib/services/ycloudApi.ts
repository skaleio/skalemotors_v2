import { supabase } from "@/lib/supabase";

export type YCloudConnectionStatus = {
  connected: boolean;
  provider: string;
  inbox_id: string | null;
  phone_number_id: string | null;
  display_number: string | null;
  webhook_configured: boolean;
  webhook_url: string | null;
};

export async function getYCloudStatus(branchId: string): Promise<YCloudConnectionStatus> {
  const { data, error } = await supabase.functions.invoke<YCloudConnectionStatus>("ycloud-status", {
    body: { branch_id: branchId },
  });
  if (error) throw error;
  if (data && "connected" in data) return data;
  return {
    connected: false,
    provider: "ycloud",
    inbox_id: null,
    phone_number_id: null,
    display_number: null,
    webhook_configured: false,
    webhook_url: null,
  };
}

export async function connectYCloud(
  branchId: string,
  params: {
    apiKey: string;
    phoneNumberId: string;
    displayNumber?: string;
    wabaId?: string;
    autoRegisterWebhook?: boolean;
  },
): Promise<{
  ok: true;
  message: string;
  inbox_id: string;
  phone_number_id: string;
  display_number: string | null;
  webhook_url: string | null;
  webhook_registered: boolean;
  webhook_warning: string | null;
}> {
  const { data, error } = await supabase.functions.invoke("ycloud-connect", {
    body: {
      branch_id: branchId,
      ycloud_api_key: params.apiKey,
      phone_number_id: params.phoneNumberId,
      display_number: params.displayNumber?.trim() || undefined,
      waba_id: params.wabaId?.trim() || undefined,
      auto_register_webhook: params.autoRegisterWebhook !== false,
    },
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al conectar YCloud");
  }
  return data as {
    ok: true;
    message: string;
    inbox_id: string;
    phone_number_id: string;
    display_number: string | null;
    webhook_url: string | null;
    webhook_registered: boolean;
    webhook_warning: string | null;
  };
}

export async function disconnectYCloud(
  branchId: string,
  disconnectTenantConfig = false,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("ycloud-disconnect", {
    body: { branch_id: branchId, disconnect_tenant_config: disconnectTenantConfig },
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al desconectar YCloud");
  }
}
