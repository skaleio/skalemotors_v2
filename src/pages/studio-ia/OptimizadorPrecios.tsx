import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, RefreshCw, CheckCircle2, BarChart3, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCLP } from "@/lib/format";

interface PriceData {
  make: string;
  model: string;
  year: string;
  currentPrice: string;
  mileage: string;
  condition: string;
  market: string;
}

export default function OptimizadorPrecios() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PriceData>({
    make: "",
    model: "",
    year: new Date().getFullYear().toString(),
    currentPrice: "",
    mileage: "",
    condition: "excellent",
    market: "local"
  });
  const [analysis, setAnalysis] = useState<any>(null);

  const handleInputChange = (field: keyof PriceData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAnalyze = async () => {
    if (!formData.make.trim() || !formData.model.trim() || !formData.currentPrice.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Por favor, completa marca, modelo y precio actual.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulación de análisis
      const currentPrice = parseFloat(formData.currentPrice.replace(/[^\d]/g, ''));
      const optimalPrice = currentPrice * (0.95 + Math.random() * 0.1);
      const marketAvg = currentPrice * (0.90 + Math.random() * 0.15);
      const competitorLow = currentPrice * 0.85;
      const competitorHigh = currentPrice * 1.15;
      
      setAnalysis({
        currentPrice,
        optimalPrice,
        marketAvg,
        competitorLow,
        competitorHigh,
        recommendation: optimalPrice > currentPrice ? 'increase' : optimalPrice < currentPrice * 0.95 ? 'decrease' : 'maintain',
        margin: optimalPrice - currentPrice,
        marginPercent: ((optimalPrice - currentPrice) / currentPrice) * 100
      });
      
      toast({
        title: "Análisis completado",
        description: "El análisis de precios está listo.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo realizar el análisis. Por favor, intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      make: "",
      model: "",
      year: new Date().getFullYear().toString(),
      currentPrice: "",
      mileage: "",
      condition: "excellent",
      market: "local"
    });
    setAnalysis(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <DollarSign className="h-6 w-6 text-emerald-600" />
          </div>
          Optimizador de Precios
        </h1>
        <p className="text-muted-foreground mt-2">
          Encuentra el precio óptimo para tus vehículos basado en análisis de mercado
        </p>
        <Badge variant="secondary" className="mt-2">Beta</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              Información del Vehículo
            </CardTitle>
            <CardDescription>
              Ingresa los datos del vehículo para analizar
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
                <Label htmlFor="mileage">Kilometraje</Label>
                <Input
                  id="mileage"
                  type="number"
                  placeholder="0"
                  value={formData.mileage}
                  onChange={(e) => handleInputChange('mileage', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="currentPrice">Precio Actual (CLP) *</Label>
              <Input
                id="currentPrice"
                placeholder="15.990.000"
                value={formData.currentPrice}
                onChange={(e) => handleInputChange('currentPrice', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="condition">Condición</Label>
                <Select value={formData.condition} onValueChange={(value) => handleInputChange('condition', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excelente</SelectItem>
                    <SelectItem value="very_good">Muy Buena</SelectItem>
                    <SelectItem value="good">Buena</SelectItem>
                    <SelectItem value="fair">Regular</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="market">Mercado</Label>
                <Select value={formData.market} onValueChange={(value) => handleInputChange('market', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="regional">Regional</SelectItem>
                    <SelectItem value="national">Nacional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleAnalyze} 
                disabled={loading || !formData.make.trim() || !formData.model.trim() || !formData.currentPrice.trim()}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Analizar Precio
                  </>
                )}
              </Button>
              {analysis && (
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
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Análisis de Precios
            </CardTitle>
            <CardDescription>
              {analysis ? "Recomendaciones basadas en el mercado" : "El análisis aparecerá aquí"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Análisis completado</span>
                </div>

                <div className="space-y-3">
                  <div className="p-4 border rounded-lg">
                    <Label className="text-xs text-muted-foreground mb-1">Precio Actual</Label>
                    <p className="text-2xl font-bold">{formatCLP(analysis.currentPrice)}</p>
                  </div>

                  <div className={`p-4 border rounded-lg ${
                    analysis.recommendation === 'increase' ? 'bg-green-50 dark:bg-green-950/20 border-green-200' :
                    analysis.recommendation === 'decrease' ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200' :
                    'bg-blue-50 dark:bg-blue-950/20 border-blue-200'
                  }`}>
                    <Label className="text-xs text-muted-foreground mb-1">Precio Óptimo Recomendado</Label>
                    <p className="text-2xl font-bold">{formatCLP(analysis.optimalPrice)}</p>
                    {analysis.margin !== 0 && (
                      <p className={`text-sm mt-1 ${
                        analysis.margin > 0 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {analysis.margin > 0 ? '+' : ''}{formatCLP(analysis.margin)} ({analysis.marginPercent > 0 ? '+' : ''}{analysis.marginPercent.toFixed(1)}%)
                      </p>
                    )}
                  </div>

                  <div className="p-4 border rounded-lg">
                    <Label className="text-xs text-muted-foreground mb-1">Precio Promedio del Mercado</Label>
                    <p className="text-xl font-semibold">{formatCLP(analysis.marketAvg)}</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <Label className="text-xs text-muted-foreground mb-2">Rango de Competencia</Label>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Mínimo</span>
                      <span className="font-medium">{formatCLP(analysis.competitorLow)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Máximo</span>
                      <span className="font-medium">{formatCLP(analysis.competitorHigh)}</span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg flex items-start gap-3 ${
                    analysis.recommendation === 'increase' ? 'bg-green-50 dark:bg-green-950/20' :
                    analysis.recommendation === 'decrease' ? 'bg-orange-50 dark:bg-orange-950/20' :
                    'bg-blue-50 dark:bg-blue-950/20'
                  }`}>
                    <AlertCircle className={`h-5 w-5 mt-0.5 ${
                      analysis.recommendation === 'increase' ? 'text-green-600' :
                      analysis.recommendation === 'decrease' ? 'text-orange-600' :
                      'text-blue-600'
                    }`} />
                    <div>
                      <p className="font-semibold mb-1">Recomendación</p>
                      <p className="text-sm text-muted-foreground">
                        {analysis.recommendation === 'increase' 
                          ? 'Se recomienda aumentar el precio para maximizar el margen de ganancia.'
                          : analysis.recommendation === 'decrease'
                          ? 'Se recomienda reducir el precio para mejorar la competitividad.'
                          : 'El precio actual está bien posicionado en el mercado.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground">
                <DollarSign className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">No hay análisis disponible</p>
                <p className="text-sm">Completa el formulario y haz clic en "Analizar Precio"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información */}
      <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Factores considerados en el análisis</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Precios de mercado y competencia</li>
                <li>• Condición y kilometraje del vehículo</li>
                <li>• Demanda actual del modelo</li>
                <li>• Tendencias estacionales</li>
                <li>• Margen de ganancia óptimo</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
