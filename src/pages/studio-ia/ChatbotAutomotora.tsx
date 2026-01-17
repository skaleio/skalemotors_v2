import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, Sparkles } from "lucide-react";

export default function ChatbotAutomotora() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <MessageSquare className="h-6 w-6 text-blue-600" />
          </div>
          Chatbot para Automotora
        </h1>
        <p className="text-muted-foreground mt-2">
          Crea chatbots inteligentes para atención al cliente y consultas sobre vehículos
        </p>
        <Badge variant="secondary" className="mt-2">Próximamente</Badge>
      </div>

      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="pt-12 pb-12">
          <div className="text-center max-w-md mx-auto">
            <div className="p-4 bg-blue-500/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Clock className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Próximamente Disponible</h2>
            <p className="text-muted-foreground mb-6">
              Estamos trabajando en esta herramienta para ayudarte a crear chatbots inteligentes que mejoren la atención al cliente y faciliten consultas sobre vehículos.
            </p>
            <div className="space-y-3 text-left bg-white/50 dark:bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Conversaciones naturales e inteligentes</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Soporte multiidioma</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Integración lista con tu sistema</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Analytics y métricas incluidas</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
