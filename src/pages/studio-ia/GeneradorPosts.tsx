import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Sparkles, Copy, Download, RefreshCw, CheckCircle2, Hash } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PostData {
  platform: string;
  topic: string;
  tone: string;
  includeHashtags: boolean;
  callToAction: string;
  content: string;
}

export default function GeneradorPosts() {
  const [loading, setLoading] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<string>("");
  const [formData, setFormData] = useState<PostData>({
    platform: "instagram",
    topic: "",
    tone: "friendly",
    includeHashtags: true,
    callToAction: "visit",
    content: ""
  });

  const handleInputChange = (field: keyof PostData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor, ingresa el tema del post.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const post = generatePostMock(formData);
      setGeneratedPost(post);
      
      toast({
        title: "Post generado",
        description: "Tu post está listo para publicar.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el post. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePostMock = (data: PostData): string => {
    const platformLabels: Record<string, string> = {
      instagram: "Instagram",
      facebook: "Facebook",
      twitter: "Twitter/X",
      linkedin: "LinkedIn"
    };

    const hashtags = {
      instagram: "#automotriz #vehiculos #autos #carros #chile #santiago #ventadeautos #autosusados #autonuevos",
      facebook: "#Automotriz #Vehículos #Autos #Chile",
      twitter: "#Automotriz #Vehículos #Autos",
      linkedin: "#Automotriz #Vehículos #Negocios #Chile"
    };

    let post = `${data.topic}\n\n`;

    if (data.content) {
      post += `${data.content}\n\n`;
    }

    if (data.tone === 'friendly') {
      post += `¡Hola! 👋\n\n`;
    } else if (data.tone === 'professional') {
      post += `En ${platformLabels[data.platform]}, nos complace presentarte:\n\n`;
    } else if (data.tone === 'excited') {
      post += `¡Increíble noticia! 🚗✨\n\n`;
    }

    post += `${data.topic}\n\n`;

    if (data.platform === 'instagram') {
      post += `✨ Características destacadas:\n`;
      post += `• Calidad garantizada\n`;
      post += `• Mejor precio del mercado\n`;
      post += `• Financiamiento disponible\n\n`;
    } else if (data.platform === 'facebook') {
      post += `📋 Información importante:\n`;
      post += `• Vehículo en excelente estado\n`;
      post += `• Revisión técnica al día\n`;
      post += `• Listo para entregar\n\n`;
    }

    const ctas = {
      visit: "📍 Visítanos o escríbenos para más información",
      contact: "📞 Contáctanos para agendar tu test drive",
      follow: "👆 Síguenos para más contenido como este",
      dm: "💬 Escríbenos por DM si tienes preguntas"
    };

    post += `${ctas[data.callToAction as keyof typeof ctas] || ctas.visit}\n\n`;

    if (data.includeHashtags) {
      post += `${hashtags[data.platform as keyof typeof hashtags] || hashtags.instagram}`;
    }

    return post;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPost);
    toast({
      title: "Copiado",
      description: "El post ha sido copiado al portapapeles.",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([generatedPost], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `post-${formData.platform}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Descargado",
      description: "El post ha sido descargado exitosamente.",
    });
  };

  const handleReset = () => {
    setFormData({
      platform: "instagram",
      topic: "",
      tone: "friendly",
      includeHashtags: true,
      callToAction: "visit",
      content: ""
    });
    setGeneratedPost("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Megaphone className="h-6 w-6 text-blue-600" />
          </div>
          Generador de Posts para Redes
        </h1>
        <p className="text-muted-foreground mt-2">
          Crea posts atractivos para Instagram, Facebook y otras redes sociales
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Configuración del Post
            </CardTitle>
            <CardDescription>
              Personaliza tu post según la plataforma y audiencia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="platform">Plataforma</Label>
              <Select value={formData.platform} onValueChange={(value) => handleInputChange('platform', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="topic">Tema del Post *</Label>
              <Input
                id="topic"
                placeholder="Ej: Nuevo Toyota Corolla Cross 2024 disponible"
                value={formData.topic}
                onChange={(e) => handleInputChange('topic', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="tone">Tono</Label>
              <Select value={formData.tone} onValueChange={(value) => handleInputChange('tone', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Amigable</SelectItem>
                  <SelectItem value="professional">Profesional</SelectItem>
                  <SelectItem value="excited">Entusiasta</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="content">Contenido Adicional (Opcional)</Label>
              <Textarea
                id="content"
                placeholder="Agrega información adicional, detalles, beneficios..."
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                rows={3}
                className="resize-none"
              />
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
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="includeHashtags"
                checked={formData.includeHashtags}
                onChange={(e) => handleInputChange('includeHashtags', e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="includeHashtags" className="text-sm font-normal cursor-pointer">
                Incluir hashtags automáticos
              </Label>
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
                    Generar Post
                  </>
                )}
              </Button>
              {generatedPost && (
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
                  <Megaphone className="h-5 w-5 text-blue-500" />
                  Post Generado
                </CardTitle>
                <CardDescription>
                  {generatedPost ? "Tu post está listo para publicar" : "El post aparecerá aquí"}
                </CardDescription>
              </div>
              {generatedPost && (
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
            {generatedPost ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Post generado exitosamente</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 border max-h-[500px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-foreground">
                    {generatedPost}
                  </pre>
                </div>
                {formData.includeHashtags && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Hash className="h-3 w-3" />
                    <span>Hashtags incluidos automáticamente</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <Megaphone className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No hay post generado</p>
                <p className="text-sm">Completa el formulario y haz clic en "Generar Post"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Megaphone className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Mejores prácticas para posts</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Usa imágenes de alta calidad</li>
                <li>• Publica en horarios de mayor engagement</li>
                <li>• Responde comentarios rápidamente</li>
                <li>• Usa hashtags relevantes y específicos</li>
                <li>• Incluye un call-to-action claro</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
