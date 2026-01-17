import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Image, Upload, Sparkles, RefreshCw, CheckCircle2, Download, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ImageData {
  quality: string;
  format: string;
  background: string;
  size: string;
  enhancement: string[];
}

export default function OptimizadorImagenes() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ImageData>({
    quality: "high",
    format: "jpg",
    background: "auto",
    size: "original",
    enhancement: []
  });
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<string[]>([]);

  const handleInputChange = (field: keyof ImageData, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadedImages(prev => [...prev, ...files]);
      toast({
        title: "Imágenes cargadas",
        description: `${files.length} imagen(es) cargada(s) exitosamente.`,
      });
    }
  };

  const handleProcess = async () => {
    if (uploadedImages.length === 0) {
      toast({
        title: "Sin imágenes",
        description: "Por favor, carga al menos una imagen para procesar.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Simulación de procesamiento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // En producción, aquí se procesarían las imágenes con IA
      const processed = uploadedImages.map((_, i) => `processed-image-${i + 1}.${formData.format}`);
      setProcessedImages(processed);
      
      toast({
        title: "Imágenes procesadas",
        description: `${uploadedImages.length} imagen(es) optimizada(s) exitosamente.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron procesar las imágenes. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUploadedImages([]);
    setProcessedImages([]);
    setFormData({
      quality: "high",
      format: "jpg",
      background: "auto",
      size: "original",
      enhancement: []
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Image className="h-6 w-6 text-orange-600" />
          </div>
          Optimizador de Imágenes
        </h1>
        <p className="text-muted-foreground mt-2">
          Mejora y optimiza las imágenes de tus vehículos con IA
        </p>
        <Badge variant="secondary" className="mt-2">Beta</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-500" />
              Configuración
            </CardTitle>
            <CardDescription>
              Ajusta los parámetros de optimización
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="quality">Calidad</Label>
              <Select value={formData.quality} onValueChange={(value) => handleInputChange('quality', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Estándar</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="format">Formato de Salida</Label>
              <Select value={formData.format} onValueChange={(value) => handleInputChange('format', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jpg">JPG</SelectItem>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="background">Fondo</Label>
              <Select value={formData.background} onValueChange={(value) => handleInputChange('background', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático</SelectItem>
                  <SelectItem value="white">Blanco</SelectItem>
                  <SelectItem value="transparent">Transparente</SelectItem>
                  <SelectItem value="gradient">Gradiente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="size">Tamaño</Label>
              <Select value={formData.size} onValueChange={(value) => handleInputChange('size', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original</SelectItem>
                  <SelectItem value="1920x1080">1920x1080 (Full HD)</SelectItem>
                  <SelectItem value="1280x720">1280x720 (HD)</SelectItem>
                  <SelectItem value="800x600">800x600 (Web)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t">
              <Label className="mb-3 block">Mejoras Adicionales</Label>
              <div className="space-y-2">
                {['Ajuste de brillo', 'Mejora de contraste', 'Reducción de ruido', 'Enfoque automático'].map((enhancement) => (
                  <div key={enhancement} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={enhancement}
                      checked={formData.enhancement.includes(enhancement)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleInputChange('enhancement', [...formData.enhancement, enhancement]);
                        } else {
                          handleInputChange('enhancement', formData.enhancement.filter(e => e !== enhancement));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={enhancement} className="text-sm font-normal cursor-pointer">
                      {enhancement}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carga y Resultado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              Cargar y Procesar
            </CardTitle>
            <CardDescription>
              Sube las imágenes de tus vehículos para optimizar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="image-upload" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-700 font-medium">
                  Haz clic para cargar
                </span>
                <span className="text-muted-foreground"> o arrastra las imágenes aquí</span>
              </Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-xs text-muted-foreground mt-2">
                PNG, JPG, WEBP hasta 10MB
              </p>
            </div>

            {uploadedImages.length > 0 && (
              <div className="space-y-2">
                <Label>Imágenes cargadas ({uploadedImages.length})</Label>
                <div className="grid grid-cols-3 gap-2">
                  {uploadedImages.map((file, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleProcess} 
                disabled={loading || uploadedImages.length === 0}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Optimizar Imágenes
                  </>
                )}
              </Button>
              {uploadedImages.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {processedImages.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{processedImages.length} imagen(es) procesada(s)</span>
                </div>
                <Button variant="outline" className="w-full" onClick={() => {
                  toast({
                    title: "Descarga iniciada",
                    description: "Las imágenes optimizadas se están descargando.",
                  });
                }}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Todas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información */}
      <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Image className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Sobre la optimización de imágenes</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Mejora automática de calidad y resolución</li>
                <li>• Generación de fondos profesionales</li>
                <li>• Optimización para portales web y redes sociales</li>
                <li>• Reducción de tamaño sin pérdida de calidad visible</li>
                <li>• Procesamiento por lotes para múltiples imágenes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
