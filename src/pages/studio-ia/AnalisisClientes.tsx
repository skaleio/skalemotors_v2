import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Clock, Sparkles } from "lucide-react";

export default function AnalisisClientes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Brain className="h-6 w-6 text-blue-600" />
          </div>
          Análisis de Clientes
        </h1>
        <p className="text-muted-foreground mt-2">
          Analiza reviews, comentarios y feedback de clientes
        </p>
        <Badge variant="secondary" className="mt-2">Próximamente</Badge>
      </div>

      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="pt-12 pb-12">
          <div className="text-center max-w-md mx-auto">
            <div className="p-4 bg-blue-500/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Clock className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Próximamente Disponible</h2>
            <p className="text-muted-foreground mb-6">
              Estamos desarrollando esta herramienta para ayudarte a entender mejor las necesidades del mercado automotriz mediante análisis inteligente de feedback de clientes.
            </p>
            <div className="space-y-3 text-left bg-white/50 dark:bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Análisis de sentimientos en reviews</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Detección de tendencias y patrones</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Feedback de clientes estructurado</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Insights de mercado automotriz</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
