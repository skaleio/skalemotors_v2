import { useState } from "react";
import { X, Send, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { sendSupportChatMessage } from "@/lib/services/supportChatApi";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface SupportChatProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: "chileautos" | "mercadolibre" | "facebook" | null;
}

const WELCOME_MESSAGE = "¡Hola! Soy el cerebro del negocio. Puedo responder preguntas sobre ventas, inventario, leads, finanzas y métricas de tu automotora. ¿Qué te gustaría saber?";

export default function SupportChat({ isOpen, onClose, platform }: SupportChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: WELCOME_MESSAGE,
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getPlatformName = () => {
    switch (platform) {
      case "chileautos":
        return "Chileautos";
      case "mercadolibre":
        return "Mercado Libre";
      case "facebook":
        return "Facebook Marketplace";
      default:
        return "SKALEMOTORS";
    }
  };

  const buildHistory = (): Array<{ role: "user" | "assistant"; content: string }> => {
    const out: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const m of messages) {
      if (m.sender === "user") out.push({ role: "user", content: m.text });
      if (m.sender === "bot") out.push({ role: "assistant", content: m.text });
    }
    return out;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    const history = buildHistory();

    const result = await sendSupportChatMessage(
      inputMessage.trim(),
      user?.branch_id ?? null,
      history
    );

    setIsLoading(false);

    if (result.ok) {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: result.text,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } else {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `No pude responder: ${result.error}`,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] max-h-[80vh] shadow-2xl">
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle className="text-lg font-semibold">
              Cerebro del negocio - {getPlatformName()}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-white hover:bg-blue-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
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

          {/* Input Area */}
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Pregunta por ventas, inventario, leads, finanzas..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
              className="flex-1"
              disabled={isLoading}
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
