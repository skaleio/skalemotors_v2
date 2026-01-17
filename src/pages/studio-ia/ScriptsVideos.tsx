import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Clock, Sparkles } from "lucide-react";

export default function ScriptsVideos() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <Video className="h-6 w-6 text-red-600" />
          </div>
          Scripts para Videos
        </h1>
        <p className="text-muted-foreground mt-2">
          Crea guiones profesionales para videos promocionales y reviews de vehículos
        </p>
        <Badge variant="secondary" className="mt-2">Próximamente</Badge>
      </div>

      <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200 dark:border-red-900">
        <CardContent className="pt-12 pb-12">
          <div className="text-center max-w-md mx-auto">
            <div className="p-4 bg-red-500/20 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Clock className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Próximamente Disponible</h2>
            <p className="text-muted-foreground mb-6">
              Estamos desarrollando esta herramienta para ayudarte a crear guiones profesionales para videos promocionales, reviews de vehículos y contenido social.
            </p>
            <div className="space-y-3 text-left bg-white/50 dark:bg-black/20 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-red-600" />
                <span className="text-sm">Scripts personalizados para diferentes formatos</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-red-600" />
                <span className="text-sm">Múltiples estilos y tonos</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-red-600" />
                <span className="text-sm">Call-to-actions optimizados</span>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-red-600" />
                <span className="text-sm">Storytelling efectivo</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
