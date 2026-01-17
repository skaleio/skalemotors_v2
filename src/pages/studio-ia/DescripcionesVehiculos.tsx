import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Car, Sparkles, Copy, Download, RefreshCw, CheckCircle2, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DescriptionData {
  make: string;
  model: string;
  year: string;
  mileage: string;
  color: string;
  price: string;
  features: string;
  tone: string;
  format: string;
}

export default function DescripcionesVehiculos() {
  const [loading, setLoading] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState<string>("");
  const [formData, setFormData] = useState<DescriptionData>({
    make: "",
    model: "",
    year: new Date().getFullYear().toString(),
    mileage: "",
    color: "",
    price: "",
    features: "",
    tone: "professional",
    format: "portal"
  });

  const handleInputChange = (field: keyof DescriptionData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerate = async () => {
    if (!formData.make.trim() || !formData.model.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Por favor, ingresa la marca y modelo del vehículo.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const description = generateDescriptionMock(formData);
      setGeneratedDescription(description);
      
      toast({
        title: "Descripción generada",
        description: "Tu descripción está lista para usar.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar la descripción. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDescriptionMock = (data: DescriptionData): string => {
    const toneText = {
      professional: "Profesional",
      friendly: "Amigable",
      persuasive: "Persuasivo",
      technical: "Técnico"
    };

    return `DESCRIPCIÓN DEL VEHÍCULO

${data.make} ${data.model} ${data.year}

${data.tone === 'professional' ? 
  `Presentamos el ${data.make} ${data.model} ${data.year}, un vehículo que combina diseño moderno, tecnología avanzada y rendimiento excepcional.` :
  data.tone === 'friendly' ?
  `¡Conoce el ${data.make} ${data.model} ${data.year}! Este increíble vehículo tiene todo lo que buscas y más.` :
  data.tone === 'persuasive' ?
  `No te pierdas la oportunidad de tener el ${data.make} ${data.model} ${data.year}. Este vehículo es la elección perfecta para ti.` :
  `El ${data.make} ${data.model} ${data.year} presenta características técnicas destacadas y un diseño optimizado para el rendimiento.`}

${data.color ? `Color: ${data.color}` : ''}
${data.mileage ? `Kilometraje: ${data.mileage} km` : ''}
${data.price ? `Precio: $${data.price}` : ''}

${data.features ? `CARACTERÍSTICAS DESTACADAS:\n${data.features.split('\n').map(f => `• ${f.trim()}`).filter(f => f.length > 2).join('\n')}` : 'CARACTERÍSTICAS DESTACADAS:\n• Diseño moderno y elegante\n• Tecnología de última generación\n• Máxima seguridad\n• Confort excepcional'}

${data.tone === 'professional' ?
  `Este vehículo representa la excelencia en ingeniería automotriz, ofreciendo una experiencia de conducción superior que combina potencia, eficiencia y confort.` :
  data.tone === 'friendly' ?
  `Este vehículo es perfecto para ti y tu familia. Ven a conocerlo y descubre por qué es la mejor opción.` :
  data.tone === 'persuasive' ?
  `Oportunidad única. Este vehículo no durará mucho tiempo disponible. Contáctanos ahora y agenda tu test drive.` :
  `Equipado con las últimas innovaciones tecnológicas y sistemas de seguridad avanzados, este vehículo garantiza un rendimiento óptimo en todas las condiciones.`}

${data.format === 'portal' ? 
  '\nIDEAL PARA:\n• Uso familiar\n• Viajes largos\n• Ciudad y carretera\n• Máxima seguridad' :
  data.format === 'social' ?
  '\n✨ Lo que más te va a encantar:\n• Diseño impresionante\n• Tecnología de punta\n• Confort premium\n• Excelente relación precio-calidad' :
  '\nVENTAJAS COMPETITIVAS:\n• Mejor precio del mercado\n• Financiamiento disponible\n• Garantía extendida\n• Servicio post-venta de excelencia'}

${data.tone === 'persuasive' ? '\n📞 ¡Agenda tu test drive hoy mismo! No dejes pasar esta oportunidad.' : ''}
${data.tone === 'friendly' ? '\n😊 Estamos aquí para ayudarte. ¡Visítanos!' : ''}
${data.tone === 'professional' ? '\nPara más información, contáctanos y nuestro equipo estará encantado de atenderte.' : ''}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDescription);
    toast({
      title: "Copiado",
      description: "La descripción ha sido copiada al portapapeles.",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([generatedDescription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `descripcion-${formData.make}-${formData.model}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Descargado",
      description: "La descripción ha sido descargada exitosamente.",
    });
  };

  const handleReset = () => {
    setFormData({
      make: "",
      model: "",
      year: new Date().getFullYear().toString(),
      mileage: "",
      color: "",
      price: "",
      features: "",
      tone: "professional",
      format: "portal"
    });
    setGeneratedDescription("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Car className="h-6 w-6 text-blue-600" />
          </div>
          Descripciones de Vehículos
        </h1>
        <p className="text-muted-foreground mt-2">
          Genera descripciones profesionales y atractivas para tus vehículos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Información del Vehículo
            </CardTitle>
            <CardDescription>
              Completa los datos para generar la descripción
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="make">Marca *</Label>
                <Input
                  id="make"
                  placeholder="Ej: Toyota"
                  value={formData.make}
                  onChange={(e) => handleInputChange('make', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="model">Modelo *</Label>
                <Input
                  id="model"
                  placeholder="Ej: Corolla Cross"
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Año</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="2024"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="Ej: Blanco perla"
                  value={formData.color}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mileage">Kilometraje</Label>
                <Input
                  id="mileage"
                  type="number"
                  placeholder="0"
                  value={formData.mileage}
                  onChange={(e) => handleInputChange('mileage', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="price">Precio (CLP)</Label>
                <Input
                  id="price"
                  placeholder="15.990.000"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                />
              </div>
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
                  <SelectItem value="persuasive">Persuasivo</SelectItem>
                  <SelectItem value="technical">Técnico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="format">Formato</Label>
              <Select value={formData.format} onValueChange={(value) => handleInputChange('format', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portal">Portal Web</SelectItem>
                  <SelectItem value="social">Redes Sociales</SelectItem>
                  <SelectItem value="catalog">Catálogo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="features">Características (Opcional)</Label>
              <Textarea
                id="features"
                placeholder="Lista las características principales, una por línea. Ej:&#10;Motor 2.0L turbo&#10;Transmisión automática 8 velocidades&#10;Pantalla táctil 10 pulgadas&#10;Sistema de seguridad avanzado"
                value={formData.features}
                onChange={(e) => handleInputChange('features', e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleGenerate} 
                disabled={loading || !formData.make.trim() || !formData.model.trim()}
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
                    Generar Descripción
                  </>
                )}
              </Button>
              {generatedDescription && (
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
                  <FileText className="h-5 w-5 text-blue-500" />
                  Descripción Generada
                </CardTitle>
                <CardDescription>
                  {generatedDescription ? "Tu descripción está lista" : "La descripción aparecerá aquí"}
                </CardDescription>
              </div>
              {generatedDescription && (
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
            {generatedDescription ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Descripción generada exitosamente</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 border max-h-[500px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                    {generatedDescription}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <Car className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No hay descripción generada</p>
                <p className="text-sm">Completa el formulario y haz clic en "Generar Descripción"</p>
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
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Tips para mejores descripciones</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Incluye características técnicas relevantes</li>
                <li>• Destaca los beneficios para el comprador</li>
                <li>• Usa un tono acorde al público objetivo</li>
                <li>• Optimiza para SEO incluyendo palabras clave</li>
                <li>• Personaliza según el formato de publicación</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
