import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Palette, Sparkles, RefreshCw, CheckCircle2, Download, Type, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BrandData {
  name: string;
  industry: string;
  values: string;
  targetAudience: string;
  style: string;
  color1: string;
  color2: string;
  color3: string;
}

export default function IdentidadMarca() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BrandData>({
    name: "",
    industry: "general",
    values: "",
    targetAudience: "general",
    style: "modern",
    color1: "#3B82F6",
    color2: "#10B981",
    color3: "#F59E0B"
  });
  const [brandGuidelines, setBrandGuidelines] = useState<any>(null);

  const handleInputChange = (field: keyof BrandData, value: string) => {
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
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulación de generación
      setBrandGuidelines({
        colors: {
          primary: formData.color1,
          secondary: formData.color2,
          accent: formData.color3
        },
        typography: {
          heading: "Inter Bold",
          body: "Inter Regular"
        },
        logo: "generated-logo.svg",
        guidelines: `Guía de marca para ${formData.name}`
      });
      
      toast({
        title: "Identidad generada",
        description: "Tu identidad de marca está lista.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar la identidad. Por favor, intenta nuevamente.",
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
      values: "",
      targetAudience: "general",
      style: "modern",
      color1: "#3B82F6",
      color2: "#10B981",
      color3: "#F59E0B"
    });
    setBrandGuidelines(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Palette className="h-6 w-6 text-green-600" />
          </div>
          Asistente de Identidad de Marca
        </h1>
        <p className="text-muted-foreground mt-2">
          Desarrolla y refina la identidad visual de tu automotora
        </p>
        <Badge variant="secondary" className="mt-2">Beta</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-green-500" />
              Información de la Marca
            </CardTitle>
            <CardDescription>
              Define los elementos clave de tu identidad
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
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="targetAudience">Audiencia Objetivo</Label>
                <Select value={formData.targetAudience} onValueChange={(value) => handleInputChange('targetAudience', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="young">Jóvenes</SelectItem>
                    <SelectItem value="families">Familias</SelectItem>
                    <SelectItem value="professionals">Profesionales</SelectItem>
                    <SelectItem value="luxury">Alto Nivel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="style">Estilo Visual</Label>
              <Select value={formData.style} onValueChange={(value) => handleInputChange('style', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Moderno</SelectItem>
                  <SelectItem value="minimal">Minimalista</SelectItem>
                  <SelectItem value="classic">Clásico</SelectItem>
                  <SelectItem value="bold">Audaz</SelectItem>
                  <SelectItem value="elegant">Elegante</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="values">Valores y Personalidad</Label>
              <Textarea
                id="values"
                placeholder="Describe los valores de tu marca. Ej: Confianza, Innovación, Calidad, Servicio al cliente..."
                value={formData.values}
                onChange={(e) => handleInputChange('values', e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div>
              <Label>Paleta de Colores</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <Label htmlFor="color1" className="text-xs text-muted-foreground mb-1 block">Principal</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color1"
                      type="color"
                      value={formData.color1}
                      onChange={(e) => handleInputChange('color1', e.target.value)}
                      className="w-12 h-10 p-1 border rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color1}
                      onChange={(e) => handleInputChange('color1', e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="color2" className="text-xs text-muted-foreground mb-1 block">Secundario</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color2"
                      type="color"
                      value={formData.color2}
                      onChange={(e) => handleInputChange('color2', e.target.value)}
                      className="w-12 h-10 p-1 border rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color2}
                      onChange={(e) => handleInputChange('color2', e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="color3" className="text-xs text-muted-foreground mb-1 block">Acento</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color3"
                      type="color"
                      value={formData.color3}
                      onChange={(e) => handleInputChange('color3', e.target.value)}
                      className="w-12 h-10 p-1 border rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={formData.color3}
                      onChange={(e) => handleInputChange('color3', e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleGenerate} 
                disabled={loading || !formData.name.trim()}
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
                    Generar Identidad
                  </>
                )}
              </Button>
              {brandGuidelines && (
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
              <Palette className="h-5 w-5 text-green-500" />
              Identidad Generada
            </CardTitle>
            <CardDescription>
              {brandGuidelines ? "Tu guía de marca está lista" : "La identidad aparecerá aquí"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brandGuidelines ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Identidad generada exitosamente</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Paleta de Colores</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <div className="h-16 rounded-lg mb-1" style={{ backgroundColor: brandGuidelines.colors.primary }}></div>
                        <p className="text-xs text-center font-mono">{brandGuidelines.colors.primary}</p>
                        <p className="text-xs text-center text-muted-foreground">Principal</p>
                      </div>
                      <div className="flex-1">
                        <div className="h-16 rounded-lg mb-1" style={{ backgroundColor: brandGuidelines.colors.secondary }}></div>
                        <p className="text-xs text-center font-mono">{brandGuidelines.colors.secondary}</p>
                        <p className="text-xs text-center text-muted-foreground">Secundario</p>
                      </div>
                      <div className="flex-1">
                        <div className="h-16 rounded-lg mb-1" style={{ backgroundColor: brandGuidelines.colors.accent }}></div>
                        <p className="text-xs text-center font-mono">{brandGuidelines.colors.accent}</p>
                        <p className="text-xs text-center text-muted-foreground">Acento</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                      <Type className="h-4 w-4" />
                      Tipografía
                    </Label>
                    <div className="p-3 border rounded-lg">
                      <p className="text-2xl font-bold mb-1" style={{ fontFamily: brandGuidelines.typography.heading }}>
                        {formData.name}
                      </p>
                      <p className="text-sm" style={{ fontFamily: brandGuidelines.typography.body }}>
                        Texto de ejemplo para el cuerpo
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Logo
                    </Label>
                    <div className="p-4 border rounded-lg bg-muted/50 flex items-center justify-center aspect-video">
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-2 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white font-bold text-xl">
                          {formData.name.substring(0, 2).toUpperCase()}
                        </div>
                        <p className="text-xs text-muted-foreground">Vista previa del logo</p>
                      </div>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Guía Completa (PDF)
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <Palette className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No hay identidad generada</p>
                <p className="text-sm">Completa el formulario y haz clic en "Generar Identidad"</p>
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
              <Palette className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Elementos incluidos</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Paleta de colores completa con códigos HEX</li>
                <li>• Recomendaciones de tipografía</li>
                <li>• Conceptos de logo</li>
                <li>• Guía de uso de marca</li>
                <li>• Ejemplos de aplicación</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
