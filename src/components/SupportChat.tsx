import { useState } from "react";
import { X, Send, Bot, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChat } from "@/contexts/ChatContext";

interface SupportChatProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: "chileautos" | "mercadolibre" | "facebook" | null;
}

const WELCOME_MESSAGE = "¡Hola! Soy el cerebro del negocio. Puedo responder preguntas sobre ventas, inventario, leads, finanzas y métricas de tu automotora. ¿Qué te gustaría saber?";

export default function SupportChat({ isOpen, onClose, platform }: SupportChatProps) {
  const { messages, sendMessage, clearConversation, isLoading, error } = useChat();
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    await sendMessage(text);
  };

  const displayMessages = messages.length === 0
    ? [{ role: "assistant" as const, content: WELCOME_MESSAGE, timestamp: new Date() }]
    : messages;

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] max-h-[80vh] shadow-2xl">
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle className="text-lg font-semibold">
              SKALEGPT
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearConversation}
                className="h-8 w-8 text-white hover:bg-blue-800"
                title="Limpiar conversación"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-white hover:bg-blue-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          {error && (
            <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
              {error}
            </p>
          )}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {displayMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {message.timestamp.toLocaleTimeString("es-CL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-muted flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Analizando...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Pregunta por ventas, inventario, leads, finanzas..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button onClick={handleSendMessage} size="icon" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
