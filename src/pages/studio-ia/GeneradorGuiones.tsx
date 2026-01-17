import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Video, Sparkles, Copy, Download, RefreshCw, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ScriptData {
  topic: string;
  platform: string;
  duration: string;
  style: string;
  hook: string;
  keyPoints: string;
  callToAction: string;
}

export default function GeneradorGuiones() {
  const [loading, setLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [formData, setFormData] = useState<ScriptData>({
    topic: "",
    platform: "instagram",
    duration: "15",
    style: "dynamic",
    hook: "",
    keyPoints: "",
    callToAction: "visit"
  });

  const handleInputChange = (field: keyof ScriptData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor, ingresa el tema del reel.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Simulación de generación de guión
      // En producción, aquí se conectaría con un proveedor de IA real
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const script = generateReelScript(formData);
      setGeneratedScript(script);
      
      toast({
        title: "Guión generado",
        description: "Tu guión para reel está listo.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el guión. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReelScript = (data: ScriptData): string => {
    const platformLabels: Record<string, string> = {
      instagram: "Instagram Reels",
      tiktok: "TikTok",
      youtube: "YouTube Shorts",
      facebook: "Facebook Reels"
    };

    const styleLabels: Record<string, string> = {
      dynamic: "Dinámico",
      educational: "Educativo",
      entertaining: "Entretenido",
      testimonial: "Testimonial",
      behind_scenes: "Behind the Scenes"
    };

    const hooks = {
      question: `¿Sabías que ${data.topic}?`,
      statement: `${data.topic} - y esto es lo que necesitas saber.`,
      curiosity: `Esto cambiará tu forma de ver ${data.topic}.`,
      personal: `Hace 3 meses no sabía esto sobre ${data.topic}...`,
      default: `Te voy a mostrar ${data.topic} en ${data.duration} segundos.`
    };

    const selectedHook = data.hook || hooks.default;

    const ctas = {
      visit: "Visítanos en [nombre de tu automotora] o escríbenos en el link de la bio",
      contact: "Agenda tu test drive en el link de la bio",
      follow: "Síguenos para más contenido como este",
      dm: "Escríbenos por DM si tienes preguntas",
      website: "Encuentra más información en nuestro sitio web"
    };

    const ctaText = ctas[data.callToAction as keyof typeof ctas] || ctas.visit;

    const keyPointsList = data.keyPoints
      ? data.keyPoints.split('\n').filter(p => p.trim().length > 0).slice(0, 3)
      : [];

    let script = `🎬 GUION PARA REEL - ${platformLabels[data.platform] || data.platform.toUpperCase()}\n`;
    script += `⏱️ Duración: ${data.duration} segundos\n`;
    script += `🎨 Estilo: ${styleLabels[data.style] || data.style}\n`;
    script += `\n${'='.repeat(50)}\n\n`;

    // HOOK (0-3 segundos)
    script += `📌 HOOK (0-3 segundos)\n`;
    script += `${selectedHook}\n\n`;

    // CONTENIDO PRINCIPAL
    script += `🎯 CONTENIDO PRINCIPAL (3-${parseInt(data.duration) - 3} segundos)\n\n`;
    
    if (data.style === "educational") {
      script += `Hoy te explico ${data.topic}:\n\n`;
      if (keyPointsList.length > 0) {
        keyPointsList.forEach((point, i) => {
          script += `${i + 1}. ${point.trim()}\n`;
        });
      } else {
        script += `• [Punto clave 1 sobre ${data.topic}]\n`;
        script += `• [Punto clave 2 sobre ${data.topic}]\n`;
      }
    } else if (data.style === "testimonial") {
      script += `"${data.topic}"\n\n`;
      script += `Esta es mi experiencia y por qué lo recomiendo.\n`;
    } else if (data.style === "behind_scenes") {
      script += `Te muestro ${data.topic} como nunca antes lo has visto.\n\n`;
      script += `[Mostrar proceso/backstage]\n`;
    } else {
      script += `${data.topic}\n\n`;
      if (keyPointsList.length > 0) {
        keyPointsList.forEach((point, i) => {
          script += `✨ ${point.trim()}\n`;
        });
      }
    }

    script += `\n`;

    // TRANSICIÓN
    script += `🔄 TRANSICIÓN (últimos 2 segundos)\n`;
    script += `Y esto es solo el comienzo...\n\n`;

    // CALL TO ACTION
    script += `📢 CALL TO ACTION\n`;
    script += `${ctaText}\n\n`;

    // NOTAS DE PRODUCCIÓN
    script += `${'='.repeat(50)}\n\n`;
    script += `📝 NOTAS DE PRODUCCIÓN:\n\n`;
    script += `• Música: Usa música trending y enérgica\n`;
    script += `• Textos en pantalla: Agrega subtítulos para cada punto clave\n`;
    script += `• Transiciones: Usa cortes rápidos cada 2-3 segundos\n`;
    script += `• Hashtags sugeridos: #${data.topic.replace(/\s+/g, '').toLowerCase()} #automotriz #vehiculos\n`;
    
    if (data.platform === "instagram") {
      script += `• Formato: Vertical (9:16)\n`;
      script += `• Duración ideal: 15-30 segundos\n`;
    } else if (data.platform === "tiktok") {
      script += `• Formato: Vertical (9:16)\n`;
      script += `• Duración ideal: 15-60 segundos\n`;
    } else if (data.platform === "youtube") {
      script += `• Formato: Vertical (9:16) o cuadrado (1:1)\n`;
      script += `• Duración ideal: 15-60 segundos\n`;
    }

    script += `\n💡 TIPS:\n`;
    script += `• Mantén el ritmo rápido y dinámico\n`;
    script += `• Usa primeros planos y ángulos interesantes\n`;
    script += `• Agrega efectos visuales que refuercen el mensaje\n`;
    script += `• Publica en el horario de mayor engagement de tu audiencia\n`;

    return script;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedScript);
    toast({
      title: "Copiado",
      description: "El guión ha sido copiado al portapapeles.",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guion-reel-${formData.topic.substring(0, 20).replace(/\s+/g, '-')}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Descargado",
      description: "El guión ha sido descargado exitosamente.",
    });
  };

  const handleReset = () => {
    setFormData({
      topic: "",
      platform: "instagram",
      duration: "15",
      style: "dynamic",
      hook: "",
      keyPoints: "",
      callToAction: "visit"
    });
    setGeneratedScript("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Video className="h-6 w-6 text-blue-600" />
          </div>
          Generador de Guiones para Reels
        </h1>
        <p className="text-muted-foreground mt-2">
          Crea guiones dinámicos y atractivos para reels de Instagram, TikTok y videos cortos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Configuración del Reel
            </CardTitle>
            <CardDescription>
              Completa los campos para generar tu guión optimizado para redes sociales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="topic">Tema del Reel *</Label>
              <Input
                id="topic"
                placeholder="Ej: Los 3 beneficios de comprar un vehículo eléctrico"
                value={formData.topic}
                onChange={(e) => handleInputChange('topic', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="platform">Plataforma</Label>
                <Select value={formData.platform} onValueChange={(value) => handleInputChange('platform', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram Reels</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="youtube">YouTube Shorts</SelectItem>
                    <SelectItem value="facebook">Facebook Reels</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="duration">Duración (segundos)</Label>
                <Select value={formData.duration} onValueChange={(value) => handleInputChange('duration', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 segundos</SelectItem>
                    <SelectItem value="30">30 segundos</SelectItem>
                    <SelectItem value="45">45 segundos</SelectItem>
                    <SelectItem value="60">60 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="style">Estilo del Reel</Label>
              <Select value={formData.style} onValueChange={(value) => handleInputChange('style', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">Dinámico</SelectItem>
                  <SelectItem value="educational">Educativo</SelectItem>
                  <SelectItem value="entertaining">Entretenido</SelectItem>
                  <SelectItem value="testimonial">Testimonial</SelectItem>
                  <SelectItem value="behind_scenes">Behind the Scenes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="hook">Hook / Gancho (Opcional)</Label>
              <Input
                id="hook"
                placeholder="Ej: ¿Sabías que los vehículos eléctricos ahorran hasta 70% en combustible?"
                value={formData.hook}
                onChange={(e) => handleInputChange('hook', e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Si lo dejas vacío, se generará uno automáticamente
              </p>
            </div>

            <div>
              <Label htmlFor="keyPoints">Puntos Clave (Opcional)</Label>
              <Textarea
                id="keyPoints"
                placeholder="Lista los puntos principales, uno por línea. Ej:&#10;Ahorro en combustible&#10;Cero emisiones&#10;Mantenimiento reducido"
                value={formData.keyPoints}
                onChange={(e) => handleInputChange('keyPoints', e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo 3 puntos para mantener el reel conciso
              </p>
            </div>

            <div>
              <Label htmlFor="callToAction">Call to Action</Label>
              <Select value={formData.callToAction} onValueChange={(value) => handleInputChange('callToAction', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visit">Visitar automotora</SelectItem>
                  <SelectItem value="contact">Agendar test drive</SelectItem>
                  <SelectItem value="follow">Seguir cuenta</SelectItem>
                  <SelectItem value="dm">Escribir por DM</SelectItem>
                  <SelectItem value="website">Visitar sitio web</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleGenerate} 
                disabled={loading || !formData.topic.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generar Guión
                  </>
                )}
              </Button>
              {generatedScript && (
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resultado */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-blue-500" />
                  Guión Generado
                </CardTitle>
                <CardDescription>
                  {generatedScript ? "Tu guión para reel está listo" : "El guión aparecerá aquí después de generarlo"}
                </CardDescription>
              </div>
              {generatedScript && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedScript ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Guion generado exitosamente</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 border max-h-[500px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                    {generatedScript}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <Video className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No hay guión generado</p>
                <p className="text-sm">Completa el formulario y haz clic en "Generar Guión" para comenzar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información adicional */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Tips para reels virales</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Los primeros 3 segundos son cruciales</li>
                  <li>• Usa música trending y actual</li>
                  <li>• Agrega subtítulos para mayor engagement</li>
                  <li>• Publica en horarios de alta actividad</li>
                  <li>• Responde comentarios rápidamente</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-cyan-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Mejores prácticas</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Mantén cortes rápidos (2-3 segundos)</li>
                  <li>• Usa formato vertical (9:16)</li>
                  <li>• Agrega textos en pantalla</li>
                  <li>• Incluye un CTA claro</li>
                  <li>• Usa hashtags relevantes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
