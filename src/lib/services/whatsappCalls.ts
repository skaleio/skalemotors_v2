import { supabase } from "@/lib/supabase";

export type WhatsappCallStatus = 'iniciando' | 'en_curso' | 'completada' | 'fallida' | 'cancelada' | 'no_contestada';
export type WhatsappCallDirection = 'entrante' | 'saliente';

export type WhatsappCall = {
  id: string;
  call_id: string;
  contact_phone: string;
  contact_name: string | null;
  direction: WhatsappCallDirection;
  status: WhatsappCallStatus;
  duration_seconds: number;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  transcript: string | null;
  user_id: string | null;
  branch_id: string | null;
  lead_id: string | null;
  notes: string | null;
  created_at: string;
};

export async function initiateWhatsappCall(params: {
  to: string;
  inboxId?: string | null;
}): Promise<{ call_id: string; call: WhatsappCall }> {
  const { to, inboxId } = params;
  
  const { data, error } = await supabase.functions.invoke("whatsapp-call", {
    body: {
      to,
      inbox_id: inboxId ?? null,
    },
  });

  if (error) throw error;
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to initiate call");
  }

  return data;
}

export async function fetchWhatsappCalls(params: {
  branchId?: string | null;
  limit?: number;
  status?: WhatsappCallStatus;
}): Promise<WhatsappCall[]> {
  const { branchId, limit = 100, status } = params;

  let query = supabase
    .from("whatsapp_calls")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as WhatsappCall[];
}

export async function updateCallNotes(callId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_calls")
    .update({ notes })
    .eq("id", callId);

  if (error) throw error;
}

export async function getCallById(callId: string): Promise<WhatsappCall | null> {
  const { data, error } = await supabase
    .from("whatsapp_calls")
    .select("*")
    .eq("id", callId)
    .maybeSingle();

  if (error) throw error;
  return data as WhatsappCall | null;
}
