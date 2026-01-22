import { useState } from "react";
import { X, MessageCircle, Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function SupportChat({ isOpen, onClose, platform }: SupportChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte con la integración?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");

  const getPlatformName = () => {
    switch (platform) {
      case "chileautos":
        return "Chileautos";
      case "mercadolibre":
        return "Mercado Libre";
      case "facebook":
        return "Facebook Marketplace";
      default:
        return "la plataforma";
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInputMessage("");

    // Simular respuesta del bot
    setTimeout(() => {
      const botResponse = getBotResponse(inputMessage.toLowerCase());
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 1000);
  };

  const getBotResponse = (userInput: string): string => {
    const platformName = getPlatformName();

    if (userInput.includes("token") || userInput.includes("api")) {
      if (platform === "chileautos") {
        return "Para obtener tus credenciales de Chileautos, necesitas:\n\n1. Client ID\n2. Client Secret\n3. Seller Identifier\n\nContacta a soporte@chileautos.cl para solicitarlas.";
      } else if (platform === "mercadolibre") {
        return "Para obtener tu Access Token de Mercado Libre:\n\n1. Crea una aplicación en developers.mercadolibre.cl\n2. Obtén tus credenciales\n3. Genera el token de acceso\n\n¿Necesitas ayuda con algún paso específico?";
      } else if (platform === "facebook") {
        return "Para obtener tus credenciales de Facebook:\n\n1. Ve a Meta for Developers\n2. Crea una app\n3. Obtén el Product Catalog ID\n4. Genera un Access Token\n\n¿Quieres que te envíe el enlace a la documentación?";
      }
    }

    if (userInput.includes("ayuda") || userInput.includes("problema")) {
      return `Estoy aquí para ayudarte con la integración de ${platformName}. ¿Cuál es el problema específico que estás enfrentando?\n\n- ¿Error de conexión?\n- ¿Credenciales inválidas?\n- ¿Dudas sobre la API?`;
    }

    if (userInput.includes("hola") || userInput.includes("buenos")) {
      return `¡Hola! Estoy aquí para ayudarte con la integración de ${platformName}. ¿En qué puedo asistirte?`;
    }

    if (userInput.includes("documentacion") || userInput.includes("guia")) {
      return `Puedes encontrar la documentación completa en el enlace que aparece más arriba. ¿Hay algo específico de la documentación que no entiendas?`;
    }

    return `Entiendo que necesitas ayuda con ${platformName}. Para asistirte mejor, un agente humano se pondrá en contacto contigo pronto. Mientras tanto, ¿hay algo más en lo que pueda ayudarte?`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] max-h-[80vh] shadow-2xl">
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle className="text-lg font-semibold">
              Soporte - {getPlatformName()}
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
          </div>

          {/* Input Area */}
          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Escribe tu mensaje..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
