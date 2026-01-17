import { useEffect, useMemo, useState } from "react";
import { Search, Send, Phone, Video, MoreVertical, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import {
  buildConversationsFromMessages,
  filterConversations,
  formatConversationName,
  sendWhatsappText,
  type WhatsappConversation,
  type WhatsappMessageRow,
  fetchWhatsappMessagesByBranch,
} from "@/lib/services/messages";

type RealtimeRow = Record<string, unknown>;

function isWhatsappDirection(v: unknown): v is WhatsappMessageRow["direction"] {
  return v === "entrante" || v === "saliente";
}

function isWhatsappStatus(v: unknown): v is WhatsappMessageRow["status"] {
  return v === "enviado" || v === "entregado" || v === "leido" || v === "fallido";
}

export default function Messages() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allMessages, setAllMessages] = useState<WhatsappMessageRow[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [newMessage, setNewMessage] = useState("");

  const { conversations, messagesByPhone } = useMemo(() => {
    return buildConversationsFromMessages(allMessages);
  }, [allMessages]);

  const filteredConversations = useMemo(() => {
    const base = filterConversations(conversations, searchQuery);
    if (activeTab === "all") return base;
    if (activeTab === "whatsapp") return base;
    // IG/Messenger aún no están conectados
    return [];
  }, [activeTab, conversations, searchQuery]);

  const selectedConversation = useMemo<WhatsappConversation | null>(() => {
    if (!selectedPhone) return null;
    return conversations.find((c) => c.phone === selectedPhone) ?? null;
  }, [conversations, selectedPhone]);

  const selectedMessages = useMemo(() => {
    if (!selectedPhone) return [];
    return messagesByPhone.get(selectedPhone) ?? [];
  }, [messagesByPhone, selectedPhone]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setLoading(true);
        const msgs = await fetchWhatsappMessagesByBranch({
          branchId: user?.branch_id ?? null,
          limit: 800,
        });
        if (ignore) return;
        setAllMessages(msgs);
        // Seleccionar la primera conversación si no hay selección
        if (!selectedPhone && msgs.length > 0) {
          const { conversations: convs } = buildConversationsFromMessages(msgs);
          if (convs[0]) setSelectedPhone(convs[0].phone);
        }
      } catch (e) {
        console.error("Error loading WhatsApp messages:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.branch_id]);

  useEffect(() => {
    // Realtime: escuchar inserts/updates y refrescar estado local
    const channel = supabase
      .channel("messages-whatsapp")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const next = (payload.new || payload.old) as RealtimeRow | null;
          if (!next) return;
          if (next.type !== "whatsapp") return;
          if (user?.branch_id && next.branch_id && next.branch_id !== user.branch_id) return;

          setAllMessages((prev) => {
            // Upsert por id
            const nextId = String(next.id ?? "");
            if (!nextId) return prev;
            const idx = prev.findIndex((m) => m.id === nextId);
            const mapped: WhatsappMessageRow = {
              id: nextId,
              contact_phone: next.contact_phone ? String(next.contact_phone) : null,
              contact_name: next.contact_name ? String(next.contact_name) : null,
              content: String(next.content ?? ""),
              direction: isWhatsappDirection(next.direction) ? next.direction : "entrante",
              status: isWhatsappStatus(next.status) ? next.status : "enviado",
              sent_at: String(next.sent_at ?? new Date().toISOString()),
              inbox_id: next.inbox_id ? String(next.inbox_id) : null,
              branch_id: next.branch_id ? String(next.branch_id) : null,
              user_id: next.user_id ? String(next.user_id) : null,
            };

            if (idx === -1) return [mapped, ...prev];
            const copy = [...prev];
            copy[idx] = mapped;
            return copy;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.branch_id]);

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓';
      default:
        return '';
    }
  };

  const mapStatus = (
    status: WhatsappMessageRow["status"],
  ): "sent" | "delivered" | "read" | undefined => {
    switch (status) {
      case "enviado":
        return "sent";
      case "entregado":
        return "delivered";
      case "leido":
        return "read";
      default:
        return undefined;
    }
  };

  const handleSendWhatsapp = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    const text = newMessage.trim();
    setNewMessage("");

    try {
      await sendWhatsappText({
        to: selectedConversation.phone,
        text,
      });
    } catch (e) {
      console.error("Error sending WhatsApp message:", e);
      // Si falla, restaurar el texto para que el usuario no lo pierda
      setNewMessage(text);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight">Centro de Mensajes</h1>
        <p className="text-muted-foreground">
          Gestiona todas tus conversaciones de WhatsApp, Instagram y Messenger en un solo lugar
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Conversations */}
        <div className="w-1/3 border-r bg-white">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Conversaciones</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {filteredConversations.length}
              </Badge>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar conversaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                <TabsTrigger value="instagram">Instagram</TabsTrigger>
                <TabsTrigger value="messenger">Messenger</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)]">
            {loading && (
              <div className="p-4 text-sm text-muted-foreground">
                Cargando conversaciones...
              </div>
            )}

            {!loading && filteredConversations.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                No hay conversaciones para mostrar.
              </div>
            )}

            {filteredConversations.map((conversation) => (
              <div
                key={conversation.phone}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b ${
                  selectedPhone === conversation.phone ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => setSelectedPhone(conversation.phone)}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="bg-gray-200 text-gray-700 font-semibold">
                        {formatConversationName(conversation.phone, conversation.name).split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {formatConversationName(conversation.phone, conversation.name)}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {new Date(conversation.lastTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {conversation.unreadCount > 0 && activeTab !== "instagram" && activeTab !== "messenger" && (
                          <Badge variant="destructive" className="h-5 w-5 p-0 text-xs flex items-center justify-center">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate mb-2">
                      {conversation.lastMessage}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          'border-green-500 text-green-600'
                        }`}
                      >
                        whatsapp
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {conversation.phone}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>

        {/* Right Side - Chat */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="bg-gray-200 text-gray-700 font-semibold">
                          {formatConversationName(selectedConversation.phone, selectedConversation.name).split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {formatConversationName(selectedConversation.phone, selectedConversation.name)}
                      </h3>
                      <p className="text-sm text-gray-500">{selectedConversation.phone}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={async () => {
                        try {
                          const { initiateWhatsappCall } = await import("@/lib/services/whatsappCalls");
                          await initiateWhatsappCall({
                            to: selectedConversation.phone,
                          });
                          toast({
                            title: "Llamada iniciada",
                            description: `Llamada a ${selectedConversation.phone} iniciada.`,
                          });
                        } catch (error: any) {
                          toast({
                            title: "Error",
                            description: error?.message || "No se pudo iniciar la llamada.",
                            variant: "destructive",
                          });
                        }
                      }}
                      title="Llamar por WhatsApp"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled title="Próximamente">
                      <Video className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>Ver perfil</DropdownMenuItem>
                        <DropdownMenuItem>Crear lead</DropdownMenuItem>
                        <DropdownMenuItem>Agendar cita</DropdownMenuItem>
                        <DropdownMenuItem>Silenciar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4 bg-gray-50">
                <div className="space-y-4">
                  {selectedMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === 'saliente' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          m.direction === 'saliente'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-900 shadow-sm'
                        }`}
                      >
                        <p className="text-sm">{m.content}</p>
                        <div className={`flex items-center justify-end mt-1 ${
                          m.direction === 'saliente' ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span className="text-xs">
                            {new Date(m.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {m.direction === 'saliente' && (
                            <span className="text-xs ml-1">
                              {getMessageStatusIcon(mapStatus(m.status))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t bg-white">
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendWhatsapp()}
                    className="flex-1 rounded-full"
                  />
                  <Button 
                    onClick={handleSendWhatsapp} 
                    disabled={!newMessage.trim()}
                    className="rounded-full h-10 w-10 p-0 bg-blue-500 hover:bg-blue-600"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona una conversación</h3>
                <p className="text-gray-500">
                  Elige una conversación de la lista para comenzar a chatear
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}