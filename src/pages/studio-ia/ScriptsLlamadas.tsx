import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Phone, Sparkles, Copy, Download, RefreshCw, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface ScriptData {
  type: string;
  purpose: string;
  customerType: string;
  tone: string;
  keyPoints: string;
  objections: string;
}

export default function ScriptsLlamadas() {
  const [loading, setLoading] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string>("");
  const [formData, setFormData] = useState<ScriptData>({
    type: "follow-up",
    purpose: "",
    customerType: "new",
    tone: "professional",
    keyPoints: "",
    objections: ""
  });

  const handleInputChange = (field: keyof ScriptData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerate = async () => {
    if (!formData.purpose.trim()) {
      toast.error("Por favor, ingresa el propósito de la llamada.");
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const script = generateScriptMock(formData);
      setGeneratedScript(script);

      toast.success("Tu script de llamada está listo.");
    } catch (error) {
      toast.error("No se pudo generar el script. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const generateScriptMock = (data: ScriptData): string => {
    const typeLabels: Record<string, string> = {
      "follow-up": "Seguimiento",
      "sales": "Ventas",
      "support": "Soporte",
      "appointment": "Agendamiento"
    };

    const customerLabels: Record<string, string> = {
      "new": "Nuevo Cliente",
      "existing": "Cliente Existente",
      "lead": "Lead Calificado",
      "prospect": "Prospecto"
    };

    let script = `SCRIPT DE LLAMADA - ${typeLabels[data.type] || data.type.toUpperCase()}\n`;
    script += `Tipo de Cliente: ${customerLabels[data.customerType] || data.customerType}\n`;
    script += `Tono: ${data.tone === 'professional' ? 'Profesional' : data.tone === 'friendly' ? 'Amigable' : data.tone}\n\n`;
    script += `${'='.repeat(50)}\n\n`;

    // SALUDO
    script += `📞 SALUDO INICIAL\n\n`;
    if (data.tone === 'friendly') {
      script += `"¡Hola! [Nombre], soy [Tu nombre] de [Automotora]. ¿Cómo estás hoy?"\n\n`;
    } else {
      script += `"Buenos días/tardes [Nombre], soy [Tu nombre] de [Automotora]. ¿Tienes un momento para hablar?"\n\n`;
    }

    // PROPÓSITO
    script += `🎯 PROPÓSITO DE LA LLAMADA\n\n`;
    script += `"Te llamo porque ${data.purpose}"\n\n`;

    if (data.keyPoints) {
      script += `PUNTOS CLAVE A MENCIONAR:\n`;
      data.keyPoints.split('\n').filter(p => p.trim().length > 0).forEach((point, i) => {
        script += `${i + 1}. ${point.trim()}\n`;
      });
      script += `\n`;
    }

    // OBJECIONES
    if (data.objections) {
      script += `💬 MANEJO DE OBJECIONES\n\n`;
      script += `Si el cliente menciona:\n\n`;
      data.objections.split('\n').filter(o => o.trim().length > 0).forEach((objection, i) => {
        script += `"${objection.trim()}"\n`;
        script += `→ Respuesta sugerida: "Entiendo tu preocupación. Déjame explicarte cómo podemos resolver eso..."\n\n`;
      });
    } else {
      script += `💬 OBJECIONES COMUNES\n\n`;
      script += `"El precio es muy alto"\n`;
      script += `→ "Entiendo. Tenemos opciones de financiamiento flexibles. ¿Te gustaría conocerlas?"\n\n`;
      script += `"Necesito pensarlo"\n`;
      script += `→ "Por supuesto. ¿Hay algo específico que te gustaría aclarar antes de decidir?"\n\n`;
    }

    // CIERRE
    script += `✅ CIERRE\n\n`;
    if (data.type === 'sales') {
      script += `"¿Te parece bien si agendamos una cita para que conozcas el vehículo en persona?"\n\n`;
    } else if (data.type === 'appointment') {
      script += `"¿Qué día y hora te funciona mejor para visitarnos?"\n\n`;
    } else {
      script += `"¿Hay algo más en lo que pueda ayudarte?"\n\n`;
    }

    script += `DESPEDIDA:\n`;
    script += `"Fue un placer hablar contigo. ¡Que tengas un excelente día!"\n\n`;

    script += `${'='.repeat(50)}\n\n`;
    script += `📝 NOTAS:\n`;
    script += `• Mantén un tono ${data.tone}\n`;
    script += `• Escucha activamente las necesidades del cliente\n`;
    script += `• Toma notas durante la llamada\n`;
    script += `• Agenda seguimiento si es necesario\n`;

    return script;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedScript);
    toast.success("El script ha sido copiado al portapapeles.");
  };

  const handleDownload = () => {
    const blob = new Blob([generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-llamada-${formData.type}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("El script ha sido descargado exitosamente.");
  };

  const handleReset = () => {
    setFormData({
      type: "follow-up",
      purpose: "",
      customerType: "new",
      tone: "professional",
      keyPoints: "",
      objections: ""
    });
    setGeneratedScript("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Phone className="h-6 w-6 text-green-600" />
          </div>
          Scripts para Llamadas
        </h1>
        <p className="text-muted-foreground mt-2">
          Genera scripts personalizados para llamadas de seguimiento, ventas y atención al cliente
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-500" />
              Configuración del Script
            </CardTitle>
            <CardDescription>
              Define el tipo de llamada y personaliza el script
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Tipo de Llamada</Label>
                <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow-up">Seguimiento</SelectItem>
                    <SelectItem value="sales">Ventas</SelectItem>
                    <SelectItem value="support">Soporte</SelectItem>
                    <SelectItem value="appointment">Agendamiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="customerType">Tipo de Cliente</Label>
                <Select value={formData.customerType} onValueChange={(value) => handleInputChange('customerType', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nuevo Cliente</SelectItem>
                    <SelectItem value="existing">Cliente Existente</SelectItem>
                    <SelectItem value="lead">Lead Calificado</SelectItem>
                    <SelectItem value="prospect">Prospecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="purpose">Propósito de la Llamada *</Label>
              <Textarea
                id="purpose"
                placeholder="Ej: Seguimiento sobre tu interés en el Toyota Corolla Cross, informarte sobre una promoción especial..."
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div>
              <Label htmlFor="tone">Tono</Label>
              <Select value={formData.tone} onValueChange={(value) => handleInputChange('tone', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Profesional</SelectItem>
                  <SelectItem value="friendly">Amigable</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="keyPoints">Puntos Clave (Opcional)</Label>
              <Textarea
                id="keyPoints"
                placeholder="Lista los puntos principales a mencionar, uno por línea. Ej:&#10;Precio especial esta semana&#10;Financiamiento disponible&#10;Garantía extendida"
                value={formData.keyPoints}
                onChange={(e) => handleInputChange('keyPoints', e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div>
              <Label htmlFor="objections">Objeciones Esperadas (Opcional)</Label>
              <Textarea
                id="objections"
                placeholder="Lista las objeciones que podrían surgir, una por línea. Ej:&#10;El precio es muy alto&#10;Necesito pensarlo&#10;Ya tengo otra opción"
                value={formData.objections}
                onChange={(e) => handleInputChange('objections', e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleGenerate}
                disabled={loading || !formData.purpose.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generar Script
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
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  Script Generado
                </CardTitle>
                <CardDescription>
                  {generatedScript ? "Tu script está listo para usar" : "El script aparecerá aquí"}
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
                  <span>Script generado exitosamente</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 border max-h-[500px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                    {generatedScript}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <Phone className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No hay script generado</p>
                <p className="text-sm">Completa el formulario y haz clic en "Generar Script"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información */}
      <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Phone className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Tips para llamadas efectivas</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Practica el script antes de la llamada</li>
                <li>• Escucha activamente las necesidades del cliente</li>
                <li>• Adapta el script según las respuestas</li>
                <li>• Toma notas durante la conversación</li>
                <li>• Cierra con un siguiente paso claro</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
