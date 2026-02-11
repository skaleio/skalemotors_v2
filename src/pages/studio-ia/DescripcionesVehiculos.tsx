import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { sanitizeIntegerInput } from "@/lib/format";
import { generateVehicleDescription, type VehicleDescriptionPayload } from "@/lib/services/studioIaApi";
import { Car, CheckCircle2, Copy, Download, FileText, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DescriptionData extends VehicleDescriptionPayload {
  make: string;
  model: string;
  year: string;
}

const defaultForm: DescriptionData = {
  make: "",
  model: "",
  year: new Date().getFullYear().toString(),
  mileage: "",
  variant: "",
  engine: "",
  power_cv: "",
  torque_nm: "",
  transmission: "",
  price: "",
  financiable_from: "",
  color: "",
  highlights: "",
  features: "",
  include_contact: true,
};

/** Bandera del país de origen por marca (para plantilla local). */
function getFlagForMake(make: string): string {
  const m = make.toUpperCase();
  if (/HYUNDAI|KIA|SSANGYONG|DAEWOO/.test(m)) return "🇰🇷";
  if (/CHEVROLET|FORD|JEEP|DODGE|GMC|CADILLAC|TESLA|RAM/.test(m)) return "🇺🇸";
  if (/TOYOTA|HONDA|NISSAN|MAZDA|SUZUKI|MITSUBISHI|SUBARU|LEXUS|ACURA/.test(m)) return "🇯🇵";
  if (/MERCEDES|BMW|VOLKSWAGEN|VW|AUDI|PORSCHE|OPEL/.test(m)) return "🇩🇪";
  if (/VOLVO|SAAB/.test(m)) return "🇸🇪";
  if (/LAND ROVER|JAGUAR|MINI|BENTLEY/.test(m)) return "🇬🇧";
  if (/PEUGEOT|RENAULT|CITROEN|CITROËN/.test(m)) return "🇫🇷";
  if (/FIAT|ALFA ROMEO|ALFA/.test(m)) return "🇮🇹";
  return "🇺🇸";
}

export default function DescripcionesVehiculos() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState<string>("");
  const [formData, setFormData] = useState<DescriptionData>(defaultForm);

  const handleInputChange = (field: keyof DescriptionData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const buildPayload = (): VehicleDescriptionPayload => ({
    make: formData.make.trim(),
    model: formData.model.trim(),
    year: formData.year.trim(),
    ...(formData.variant?.trim() && { variant: formData.variant.trim() }),
    ...(formData.mileage?.trim() && { mileage: formData.mileage.trim() }),
    ...(formData.engine?.trim() && { engine: formData.engine.trim() }),
    ...(formData.power_cv?.trim() && { power_cv: formData.power_cv.trim() }),
    ...(formData.torque_nm?.trim() && { torque_nm: formData.torque_nm.trim() }),
    ...(formData.transmission?.trim() && { transmission: formData.transmission }),
    ...(formData.price?.trim() && { price: formData.price.trim() }),
    ...(formData.financiable_from?.trim() && { financiable_from: formData.financiable_from.trim() }),
    ...(formData.color?.trim() && { color: formData.color.trim() }),
    ...(formData.highlights?.trim() && { highlights: formData.highlights.trim() }),
    ...(formData.features?.trim() && { features: formData.features.trim() }),
    include_contact: formData.include_contact !== false,
    ...(user?.branch_id && { branch_id: user.branch_id }),
  });

  const handleGenerate = async () => {
    if (!formData.make.trim() || !formData.model.trim()) {
      toast.error("Por favor, ingresa la marca y modelo del vehículo.");
      return;
    }

    setLoading(true);
    try {
      const result = await generateVehicleDescription(buildPayload());
      if (result.ok) {
        setGeneratedDescription(result.text);
        toast.success("Tu descripción está lista para usar.");
      } else {
        toast.warning(result.error, { description: "Se usó la plantilla local." });
        setGeneratedDescription(generateDescriptionMock(formData));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de conexión";
      toast.warning(msg.includes("Edge Function") || msg.includes("fetch")
        ? "No se pudo conectar con Studio IA. Comprueba que la Edge Function esté desplegada."
        : "No se pudo conectar con la IA.", { description: "Se usó la plantilla local." });
      setGeneratedDescription(generateDescriptionMock(formData));
    } finally {
      setLoading(false);
    }
  };

  const generateDescriptionMock = (data: DescriptionData): string => {
    const flag = getFlagForMake(data.make);
    const titleParts = [data.year, data.make, data.model, data.variant?.trim()].filter(Boolean);
    const title = titleParts.join(" ") + " " + flag;
    const parts: string[] = [title, ""];

    if (data.financiable_from?.trim()) {
      parts.push(`Financiable desde $${data.financiable_from.trim()}`, "");
    }

    const techParts = [
      data.engine && `Motor ${data.engine}`,
      data.power_cv && `${data.power_cv} CV`,
      data.torque_nm && `${data.torque_nm} Nm`,
      data.transmission && data.transmission,
    ].filter(Boolean);
    const techLine = techParts.length ? `Equipado con ${techParts.join(", ")}.` : "";
    const stateLine = data.highlights?.trim()
      ? `Unidad en excelente estado: ${data.highlights.trim()}.`
      : "";
    const extraLine = data.features?.trim() ? data.features.trim() : "";
    const paragraph = [techLine, stateLine, extraLine].filter(Boolean).join(" ");
    if (paragraph) {
      parts.push(paragraph, "");
    }

    if (data.mileage) parts.push(`${Number(data.mileage).toLocaleString("es-CL")} km`);
    parts.push(`Año ${data.year}`);
    if (data.highlights?.trim()) parts.push(data.highlights.trim());
    if (data.price?.trim()) parts.push("", `Precio Final: $${data.price.trim()}`);
    if (data.financiable_from?.trim()) parts.push(`Financiable desde: $${data.financiable_from.trim()}`);
    if (data.include_contact) parts.push("", "📱 WhatsApp: +56 9 8474 8277");
    return parts.join("\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDescription);
    toast.success("La descripción ha sido copiada al portapapeles.");
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

    toast.success("La descripción ha sido descargada exitosamente.");
  };

  const handleReset = () => {
    setFormData({ ...defaultForm, year: new Date().getFullYear().toString() });
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
                  placeholder="Ej: Toyota, Hyundai, Chevrolet"
                  value={formData.make}
                  onChange={(e) => handleInputChange('make', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="model">Modelo *</Label>
                <Input
                  id="model"
                  placeholder="Ej: Corolla Cross, Veloster, Tracker"
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="variant">Versión / variante</Label>
                <Input
                  id="variant"
                  placeholder="Ej: Top de Línea, LS, R-Design, Limited"
                  value={formData.variant ?? ""}
                  onChange={(e) => handleInputChange('variant', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="year">Año *</Label>
                <Input
                  id="year"
                  type="text"
                  inputMode="numeric"
                  placeholder="2024"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', sanitizeIntegerInput(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mileage">Kilometraje (km)</Label>
                <Input
                  id="mileage"
                  type="text"
                  inputMode="numeric"
                  placeholder="72.000"
                  value={formData.mileage ?? ""}
                  onChange={(e) => handleInputChange('mileage', sanitizeIntegerInput(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="Ej: Blanco perla"
                  value={formData.color ?? ""}
                  onChange={(e) => handleInputChange('color', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="engine">Motor</Label>
                <Input
                  id="engine"
                  placeholder="Ej: 1.6 Turbo, 5.3L V8"
                  value={formData.engine ?? ""}
                  onChange={(e) => handleInputChange('engine', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="power_cv">Potencia (CV)</Label>
                <Input
                  id="power_cv"
                  placeholder="Ej: 201"
                  value={formData.power_cv ?? ""}
                  onChange={(e) => handleInputChange('power_cv', sanitizeIntegerInput(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="torque_nm">Torque (Nm)</Label>
                <Input
                  id="torque_nm"
                  placeholder="Ej: 265"
                  value={formData.torque_nm ?? ""}
                  onChange={(e) => handleInputChange('torque_nm', sanitizeIntegerInput(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="transmission">Transmisión</Label>
              <Select
                value={formData.transmission?.trim() || "__none__"}
                onValueChange={(v) => handleInputChange('transmission', v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona o deja vacío" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  <SelectItem value="Manual 6 velocidades">Manual 6 velocidades</SelectItem>
                  <SelectItem value="Manual 5 velocidades">Manual 5 velocidades</SelectItem>
                  <SelectItem value="Automática">Automática</SelectItem>
                  <SelectItem value="CVT">CVT</SelectItem>
                  <SelectItem value="Dual clutch">Dual clutch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Precio final (CLP)</Label>
                <Input
                  id="price"
                  placeholder="10.990.000"
                  value={formData.price ?? ""}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="financiable_from">Financiable desde (CLP)</Label>
                <Input
                  id="financiable_from"
                  placeholder="3.300.000"
                  value={formData.financiable_from ?? ""}
                  onChange={(e) => handleInputChange('financiable_from', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="highlights">Destacados</Label>
              <Input
                id="highlights"
                placeholder="Ej: Único dueño, Vehículo verificado ✅, Excelente conservación"
                value={formData.highlights ?? ""}
                onChange={(e) => handleInputChange('highlights', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="features">Notas o características adicionales</Label>
              <Textarea
                id="features"
                placeholder="Texto libre para que la IA use en el párrafo (ej: techo panorámico, cuero premium, 4x4 con reductora)"
                value={formData.features ?? ""}
                onChange={(e) => handleInputChange('features', e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include_contact"
                checked={formData.include_contact !== false}
                onCheckedChange={(checked) => handleInputChange('include_contact', checked === true)}
              />
              <Label htmlFor="include_contact" className="text-sm font-normal cursor-pointer">
                Incluir contacto WhatsApp al final
              </Label>
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
                <li>• Completa motor, CV y Nm para que la descripción sea técnica y creíble</li>
                <li>• Usa &quot;Destacados&quot; para Único dueño, Vehículo verificado ✅</li>
                <li>• El resultado sigue el formato de vuestros posts (título con bandera, párrafo, precio, WhatsApp)</li>
                <li>• Podéis añadir más ejemplos en Supabase (tabla studio_ia_description_examples) para afinar el estilo</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
