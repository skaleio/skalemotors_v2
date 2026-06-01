import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  buildConversationsFromMessages,
  fetchWhatsappMessagesByBranch,
  filterConversations,
  formatConversationName,
  sendWhatsappText,
} from "@/lib/services/messages";
import { getYCloudStatus } from "@/lib/services/ycloudApi";
import { getWhatsAppStatus } from "@/lib/services/whatsappApi";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const branchId = user?.branch_id ?? null;

  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const { data: ycloudStatus } = useQuery({
    queryKey: ["ycloud-status", branchId],
    queryFn: () => getYCloudStatus(branchId!),
    enabled: !!branchId,
  });

  const { data: metaWaStatus } = useQuery({
    queryKey: ["whatsapp-status", branchId],
    queryFn: () => getWhatsAppStatus(branchId!),
    enabled: !!branchId,
  });

  const connected = Boolean(ycloudStatus?.connected || metaWaStatus?.connected);
  const activeInboxId = ycloudStatus?.connected
    ? ycloudStatus.inbox_id
    : metaWaStatus?.connected
      ? metaWaStatus.inbox_id
      : null;

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["whatsapp-messages", branchId],
    queryFn: () => fetchWhatsappMessagesByBranch({ branchId }),
    enabled: !!branchId && connected,
    refetchInterval: connected ? 15_000 : false,
  });

  const { conversations, messagesByPhone } = useMemo(
    () => buildConversationsFromMessages(messages),
    [messages],
  );

  const filtered = useMemo(
    () => filterConversations(conversations, search),
    [conversations, search],
  );

  const thread = selectedPhone ? messagesByPhone.get(selectedPhone) ?? [] : [];

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPhone || !draft.trim()) return;
      await sendWhatsappText({
        to: selectedPhone,
        text: draft.trim(),
        inboxId: activeInboxId,
      });
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", branchId] });
      toast.success("Mensaje enviado");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!branchId) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-7 w-7 text-green-600" />
          WhatsApp
        </h1>
        <p className="mt-4 text-muted-foreground text-sm">
          Tu usuario no tiene sucursal asignada. Configúrala en{" "}
          <Link to="/app/settings" className="text-primary underline">
            Configuración
          </Link>{" "}
          para ver conversaciones.
        </p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-7 w-7 text-green-600" />
          WhatsApp
        </h1>
        <p className="mt-4 text-muted-foreground text-sm">
          Conecta WhatsApp (YCloud o Meta) en{" "}
          <Link to="/app/integrations" className="text-primary underline">
            Integraciones
          </Link>{" "}
          para ver y responder mensajes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 gap-4">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-7 w-7 text-green-600" />
          WhatsApp
        </h1>
        {ycloudStatus?.connected ? (
          <span className="text-xs text-muted-foreground">YCloud</span>
        ) : metaWaStatus?.connected ? (
          <span className="text-xs text-muted-foreground">Meta</span>
        ) : null}
      </div>

      <div className="flex flex-1 min-h-0 border rounded-lg overflow-hidden bg-card">
        <div className="w-full md:w-80 border-r flex flex-col shrink-0">
          <div className="p-3 border-b">
            <Input
              placeholder="Buscar conversación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                Sin conversaciones aún
              </p>
            ) : (
              <ul>
                {filtered.map((c) => (
                  <li key={c.phone}>
                    <button
                      type="button"
                      onClick={() => setSelectedPhone(c.phone)}
                      className={cn(
                        "w-full text-left px-3 py-3 border-b hover:bg-accent/50 transition-colors",
                        selectedPhone === c.phone && "bg-accent",
                      )}
                    >
                      <div className="font-medium text-sm truncate">
                        {formatConversationName(c.phone, c.name)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.lastMessage}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(c.lastTimestamp), "dd MMM HH:mm", { locale: es })}
                        {c.unreadCount > 0 ? (
                          <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-green-600 text-white px-1">
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <div className="hidden md:flex flex-1 flex-col min-w-0">
          {!selectedPhone ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecciona una conversación
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b font-medium text-sm shrink-0">
                {formatConversationName(
                  selectedPhone,
                  thread[thread.length - 1]?.contact_name,
                )}
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                        m.direction === "saliente"
                          ? "ml-auto bg-green-600 text-white"
                          : "mr-auto bg-muted",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          m.direction === "saliente"
                            ? "text-green-100"
                            : "text-muted-foreground",
                        )}
                      >
                        {format(new Date(m.sent_at), "HH:mm", { locale: es })}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <form
                className="p-3 border-t flex gap-2 shrink-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMutation.mutate();
                }}
              >
                <Input
                  placeholder="Escribe un mensaje..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={sendMutation.isPending}
                />
                <Button type="submit" size="icon" disabled={sendMutation.isPending || !draft.trim()}>
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {selectedPhone ? (
        <p className="md:hidden text-xs text-muted-foreground text-center">
          Abre en pantalla grande para ver el hilo completo y responder.
        </p>
      ) : null}
    </div>
  );
}
