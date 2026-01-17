import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, Sparkles } from "lucide-react";

export default function EmailMarketing() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-rose-500/20 rounded-lg">
            <Mail className="h-6 w-6 text-rose-600" />
          </div>
          Email Marketing Automotriz
        </h1>
        <p className="text-muted-foreground mt-2">
          Crea emails promocionales, newsletters y secuencias automatizadas
        </p>
        <Badge variant="secondary" className="mt-2">Próximamente</Badge>
      </div>

      <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-rose-200 dark:border-rose-900">
        <CardContent className="pt-12 pb-12">
          <div className="text-center max-w-md mx-auto">
            <div className="p-4 bg-rose-500/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Clock className="h-10 w-10 text-rose-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Próximamente Disponible</h2>
            <p className="text-muted-foreground mb-6">
              Estamos trabajando en esta herramienta para ayudarte a crear emails promocionales, newsletters y secuencias automatizadas que mantengan a tus clientes y leads comprometidos.
            </p>
            <div className="space-y-3 text-left bg-white/50 dark:bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-rose-600" />
                <span className="text-sm">Templates personalizados para automotoras</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-rose-600" />
                <span className="text-sm">Secuencias automáticas de email</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-rose-600" />
                <span className="text-sm">A/B testing integrado</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-rose-600" />
                <span className="text-sm">Analytics y métricas de engagement</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
