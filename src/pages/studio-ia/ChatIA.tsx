import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Loader2, MessageSquareText, Trash2 } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import type { ChatMessage } from "@/lib/services/aiService";

const SUGGESTIONS = [
  "¿Qué vehículo lleva más tiempo en stock?",
  "¿Cuál fue el balance del último mes?",
  "¿Cuántos leads activos tenemos?",
  "¿Cuál es el vehículo más caro del inventario?",
];

export default function ChatIA() {
  const { messages, sendMessage, clearConversation, isLoading } = useChat();
  const [inputValue, setInputValue] = useState("");

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    await sendMessage(text);
  };

  const handleSuggestion = (text: string) => {
    setInputValue(text);
  };

  const displayMessages: ChatMessage[] =
    messages.length === 0
      ? []
      : messages;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <MessageSquareText className="h-6 w-6 text-blue-600" />
          </div>
          Chat IA
        </h1>
        <p className="text-muted-foreground mt-2">
          Pregunta en lenguaje natural sobre inventario, ventas, leads y finanzas de tu sucursal.
        </p>
      </div>

      <Card className="flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
          <div>
            <CardTitle className="text-lg">Conversación</CardTitle>
            <CardDescription>Cerebro del negocio con datos en tiempo real</CardDescription>
          </div>
          {displayMessages.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearConversation}>
              <Trash2 className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 gap-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {displayMessages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-6">
                  Escribe una pregunta o elige una sugerencia para comenzar.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-xl">
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s}
                      variant="secondary"
                      size="sm"
                      className="text-left whitespace-normal h-auto py-2"
                      onClick={() => handleSuggestion(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {displayMessages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
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
                <div className="max-w-[85%] rounded-lg p-3 bg-muted flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Escribiendo...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t flex gap-2">
            <Input
              placeholder="Pregunta por stock, ventas, leads, balance..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
