import { supabase } from "../supabase";

export type WhatsAppConnectionStatus = {
  connected: boolean;
  inbox_id: string | null;
  phone_number_id: string | null;
  display_number: string | null;
  status: string;
  last_error: string | null;
};

export async function getWhatsAppStatus(branchId: string): Promise<WhatsAppConnectionStatus> {
  const { data, error } = await supabase.functions.invoke<WhatsAppConnectionStatus>("whatsapp-status", {
    body: { branch_id: branchId },
  });
  if (error) throw error;
  if (data && "connected" in data) return data;
  return {
    connected: false,
    inbox_id: null,
    phone_number_id: null,
    display_number: null,
    status: "disconnected",
    last_error: null,
  };
}

export async function connectWhatsApp(
  branchId: string,
  params: {
    accessToken: string;
    phoneNumberId: string;
    wabaId?: string;
    displayNumber?: string;
  },
): Promise<{
  ok: true;
  message: string;
  inbox_id: string;
  phone_number_id: string;
  display_number: string | null;
}> {
  const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
    body: {
      branch_id: branchId,
      access_token: params.accessToken,
      phone_number_id: params.phoneNumberId,
      waba_id: params.wabaId?.trim() || undefined,
      display_number: params.displayNumber?.trim() || undefined,
    },
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al conectar WhatsApp");
  }
  return data as {
    ok: true;
    message: string;
    inbox_id: string;
    phone_number_id: string;
    display_number: string | null;
  };
}

export async function disconnectWhatsApp(branchId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("whatsapp-disconnect", {
    body: { branch_id: branchId },
  });
  if (error) throw error;
  if (data && !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error ?? "Error al desconectar WhatsApp");
  }
}
