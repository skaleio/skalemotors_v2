import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wand2, Sparkles, RefreshCw, CheckCircle2, Download, Palette } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface LogoData {
  name: string;
  industry: string;
  style: string;
  color1: string;
  color2: string;
  color3: string;
  description: string;
  elements: string[];
}

export default function GeneradorLogos() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LogoData>({
    name: "",
    industry: "general",
    style: "modern",
    color1: "#3B82F6",
    color2: "#10B981",
    color3: "#F59E0B",
    description: "",
    elements: []
  });
  const [generatedLogos, setGeneratedLogos] = useState<string[]>([]);

  const handleInputChange = (field: keyof LogoData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Campo requerido",
        description: "Por favor, ingresa el nombre de tu automotora.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Simulación de generación
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // En producción, aquí se generarían los logos con IA
      const logos = Array.from({ length: 4 }, (_, i) => `logo-${formData.name}-${i + 1}.svg`);
      setGeneratedLogos(logos);
      
      toast({
        title: "Logos generados",
        description: "Se han generado 4 variaciones de logo para tu automotora.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron generar los logos. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: "",
      industry: "general",
      style: "modern",
      color1: "#3B82F6",
      color2: "#10B981",
      color3: "#F59E0B",
      description: "",
      elements: []
    });
    setGeneratedLogos([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Wand2 className="h-6 w-6 text-blue-600" />
          </div>
          Generador de Logos
        </h1>
        <p className="text-muted-foreground mt-2">
          Crea logos profesionales y únicos para tu automotora usando IA
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-blue-500" />
              Configuración del Logo
            </CardTitle>
            <CardDescription>
              Define las características de tu logo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre de la Automotora *</Label>
              <Input
                id="name"
                placeholder="Ej: SKALE MOTORS"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="industry">Tipo de Automotora</Label>
                <Select value={formData.industry} onValueChange={(value) => handleInputChange('industry', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="luxury">Lujo</SelectItem>
                    <SelectItem value="used">Usados</SelectItem>
                    <SelectItem value="new">Nuevos</SelectItem>
                    <SelectItem value="sports">Deportivos</SelectItem>
                    <SelectItem value="electric">Eléctricos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="style">Estilo de Logo</Label>
                <Select value={formData.style} onValueChange={(value) => handleInputChange('style', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimalista</SelectItem>
                    <SelectItem value="modern">Moderno</SelectItem>
                    <SelectItem value="classic">Clásico</SelectItem>
                    <SelectItem value="creative">Creativo</SelectItem>
                    <SelectItem value="elegant">Elegante</SelectItem>
                    <SelectItem value="bold">Audaz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Colores de Marca</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <Label htmlFor="color1" className="text-xs text-muted-foreground mb-1 block">Color Principal</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color1"
                      type="color"
                      value={formData.color1}
                      onChange={(e) => handleInputChange('color1', e.target.value)}
                      className="w-16 h-10 p-1 border rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color1}
                      onChange={(e) => handleInputChange('color1', e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="color2" className="text-xs text-muted-foreground mb-1 block">Color Secundario</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color2"
                      type="color"
                      value={formData.color2}
                      onChange={(e) => handleInputChange('color2', e.target.value)}
                      className="w-16 h-10 p-1 border rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color2}
                      onChange={(e) => handleInputChange('color2', e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#10B981"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="color3" className="text-xs text-muted-foreground mb-1 block">Color Acento</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color3"
                      type="color"
                      value={formData.color3}
                      onChange={(e) => handleInputChange('color3', e.target.value)}
                      className="w-16 h-10 p-1 border rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color3}
                      onChange={(e) => handleInputChange('color3', e.target.value)}
                      className="flex-1 font-mono text-sm"
                      placeholder="#F59E0B"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción Adicional (Opcional)</Label>
              <Textarea
                id="description"
                placeholder="Describe el tipo de logo que tienes en mente, elementos específicos, símbolos, etc..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="pt-4 border-t">
              <Label className="mb-3 block">Elementos Deseados (Opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {['Rueda', 'Volante', 'Rayo', 'Escudo', 'Estrella', 'Flecha'].map((element) => (
                  <div key={element} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={element}
                      checked={formData.elements.includes(element)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleInputChange('elements', [...formData.elements, element]);
                        } else {
                          handleInputChange('elements', formData.elements.filter(e => e !== element));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={element} className="text-sm font-normal cursor-pointer">
                      {element}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleGenerate} 
                disabled={loading || !formData.name.trim()}
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
                    Generar Logos
                  </>
                )}
              </Button>
              {generatedLogos.length > 0 && (
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
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-blue-500" />
              Logos Generados
            </CardTitle>
            <CardDescription>
              {generatedLogos.length > 0 ? "Selecciona tu logo favorito" : "Los logos aparecerán aquí después de generarlos"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generatedLogos.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>4 variaciones generadas</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {generatedLogos.map((logo, index) => (
                    <div key={index} className="border rounded-lg p-4 aspect-square flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors cursor-pointer group">
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl">
                          {formData.name.substring(0, 2).toUpperCase()}
                        </div>
                        <p className="text-xs text-muted-foreground">Variación {index + 1}</p>
                        <Button size="sm" variant="outline" className="mt-2 w-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Download className="h-3 w-3 mr-1" />
                          Descargar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Todos (ZIP)
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <Wand2 className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No hay logos generados</p>
                <p className="text-sm">Completa el formulario y haz clic en "Generar Logos"</p>
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
              <Wand2 className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Formatos incluidos</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• SVG (vectorial, escalable sin pérdida de calidad)</li>
                <li>• PNG (alta resolución, fondo transparente)</li>
                <li>• JPG (para uso web y documentos)</li>
                <li>• PDF (para impresión profesional)</li>
                <li>• Brand guidelines (guía de uso de marca)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
