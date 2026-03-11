import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { sendChatMessage } from "@/lib/services/aiService";
import type { ChatMessage } from "@/lib/services/aiService";

interface ChatContextType {
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  clearConversation: () => void;
  isLoading: boolean;
  error: string | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openChat = () => setIsChatOpen(true);
  const closeChat = () => setIsChatOpen(false);
  const toggleChat = () => setIsChatOpen((prev) => !prev);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setError(null);
      setIsLoading(true);

      try {
        const conversationHistory: ChatMessage[] = [...messages, userMessage];
        const response = await sendChatMessage({
          message: trimmed,
          conversationHistory,
          branchId: user?.branch_id ?? null,
        });

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Error al conectar con el asistente.";
        setError(errMsg);
        const fallbackMessage: ChatMessage = {
          role: "assistant",
          content: `No pude responder: ${errMsg}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, fallbackMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, user?.branch_id]
  );

  return (
    <ChatContext.Provider
      value={{
        isChatOpen,
        openChat,
        closeChat,
        toggleChat,
        messages,
        sendMessage,
        clearConversation,
        isLoading,
        error,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
