import { supabase } from "@/lib/supabase";

export type MessageDirection = "entrante" | "saliente";
export type MessageStatus = "enviado" | "entregado" | "leido" | "fallido";

export type WhatsappMessageRow = {
  id: string;
  contact_phone: string | null;
  contact_name: string | null;
  content: string;
  direction: MessageDirection;
  status: MessageStatus;
  sent_at: string;
  inbox_id: string | null;
  branch_id: string | null;
  user_id: string | null;
};

export type WhatsappConversation = {
  phone: string;
  name: string | null;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
};

function safeLower(s: string | null | undefined) {
  return (s ?? "").toLowerCase();
}

export function formatConversationName(phone: string, name?: string | null) {
  return name?.trim() ? name.trim() : phone;
}

export async function fetchWhatsappMessagesByBranch(params: {
  branchId: string | null | undefined;
  limit?: number;
}) {
  const { branchId, limit = 500 } = params;

  let q = supabase
    .from("messages")
    .select(
      "id, contact_phone, contact_name, content, direction, status, sent_at, inbox_id, branch_id, user_id",
    )
    .eq("type", "whatsapp")
    .order("sent_at", { ascending: false })
    .limit(limit);

  // Si viene branchId, filtramos. Si no, devolvemos global (normalmente admin).
  if (branchId) q = q.eq("branch_id", branchId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []) as WhatsappMessageRow[];
}

export function buildConversationsFromMessages(messages: WhatsappMessageRow[]): {
  conversations: WhatsappConversation[];
  messagesByPhone: Map<string, WhatsappMessageRow[]>;
} {
  const byPhone = new Map<string, WhatsappMessageRow[]>();

  for (const m of messages) {
    const phone = m.contact_phone?.trim();
    if (!phone) continue;
    const arr = byPhone.get(phone) ?? [];
    arr.push(m);
    byPhone.set(phone, arr);
  }

  // Sort per phone ascending by time
  for (const [phone, arr] of byPhone.entries()) {
    arr.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
    byPhone.set(phone, arr);
  }

  const conversations: WhatsappConversation[] = [];
  for (const [phone, arr] of byPhone.entries()) {
    const last = arr[arr.length - 1];
    const name = last?.contact_name ?? null;
    const unreadCount = arr.filter((m) => m.direction === "entrante" && m.status !== "leido")
      .length;
    conversations.push({
      phone,
      name,
      lastMessage: last?.content ?? "",
      lastTimestamp: last?.sent_at ?? new Date().toISOString(),
      unreadCount,
    });
  }

  // Order by lastTimestamp desc
  conversations.sort(
    (a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime(),
  );

  return { conversations, messagesByPhone: byPhone };
}

export function filterConversations(
  conversations: WhatsappConversation[],
  searchQuery: string,
) {
  const q = safeLower(searchQuery).trim();
  if (!q) return conversations;
  return conversations.filter((c) => {
    return (
      safeLower(c.phone).includes(q) ||
      safeLower(c.name).includes(q) ||
      safeLower(c.lastMessage).includes(q)
    );
  });
}

export async function sendWhatsappText(params: {
  to: string;
  text: string;
  inboxId?: string | null;
}) {
  const { to, text, inboxId } = params;
  const { data, error } = await supabase.functions.invoke("whatsapp-send", {
    body: {
      to,
      text,
      inbox_id: inboxId ?? null,
    },
  });
  if (error) throw error;
  return data;
}


