import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Target,
  DollarSign,
  Users,
  Eye,
  MousePointer,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Download,
  BarChart3,
  Calendar,
  TrendingUp,
  Zap,
  Play,
  Pause,
  Edit,
  Trash2,
  Plus,
  Settings,
  Globe,
  MapPin,
  Clock,
  Award,
  Filter,
  RefreshCw
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function GoogleAds() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns");
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    campaignName: "",
    campaignType: "",
    budget: "",
    keywords: "",
    location: "",
    language: "",
    adGroupName: "",
    headline1: "",
    headline2: "",
    headline3: "",
    description1: "",
    description2: "",
    finalUrl: "",
    callToAction: ""
  });

  const campaignTypes = [
    { value: "search", label: "Búsqueda" },
    { value: "display", label: "Display" },
    { value: "shopping", label: "Shopping" },
    { value: "video", label: "Video" },
    { value: "app", label: "App" },
    { value: "smart", label: "Smart" }
  ];

  const callToActions = [
    { value: "learn_more", label: "Saber más" },
    { value: "get_quote", label: "Solicitar cotización" },
    { value: "contact_us", label: "Contáctanos" },
    { value: "visit_website", label: "Visitar sitio web" },
    { value: "call_now", label: "Llamar ahora" },
    { value: "get_directions", label: "Cómo llegar" }
  ];

  const languages = [
    { value: "es", label: "Español" },
    { value: "en", label: "Inglés" },
    { value: "pt", label: "Portugués" }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateCampaign = async () => {
    setLoading(true);

    setTimeout(() => {
      const newCampaign = {
        id: `google_camp_${Date.now()}`,
        name: formData.campaignName,
        type: formData.campaignType,
        status: "active",
        budget: formData.budget,
        spent: "0",
        impressions: "0",
        clicks: "0",
        ctr: "0%",
        cpc: "$0.00",
        conversions: "0",
        cpa: "$0.00",
        qualityScore: "N/A",
        created: new Date().toLocaleDateString(),
        keywords: formData.keywords.split(',').length
      };

      setCampaigns(prev => [...prev, newCampaign]);
      setLoading(false);

      // Reset form
      setFormData({
        campaignName: "",
        campaignType: "",
        budget: "",
        keywords: "",
        location: "",
        language: "",
        adGroupName: "",
        headline1: "",
        headline2: "",
        headline3: "",
        description1: "",
        description2: "",
        finalUrl: "",
        callToAction: ""
      });

      toast.success("Tu campaña de Google Ads ha sido creada exitosamente.");
    }, 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Activa</Badge>;
      case "paused":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pausada</Badge>;
      case "ended":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Finalizada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "search": return <Search className="h-4 w-4" />;
      case "display": return <Eye className="h-4 w-4" />;
      case "shopping": return <Globe className="h-4 w-4" />;
      case "video": return <Play className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getQualityScoreColor = (score: string) => {
    if (score === "N/A") return "text-gray-500";
    const numScore = parseInt(score);
    if (numScore >= 7) return "text-green-600";
    if (numScore >= 4) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/app/studio-ia')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Google Ads</h1>
          <p className="text-muted-foreground">
            Crea y gestiona tus campañas publicitarias en Google
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
          <TabsTrigger value="create">Crear Campaña</TabsTrigger>
          <TabsTrigger value="keywords">Palabras Clave</TabsTrigger>
          <TabsTrigger value="extensions">Extensiones</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Lista de Campañas */}
        <TabsContent value="campaigns" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Mis Campañas</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button onClick={() => setActiveTab("create")}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Campaña
              </Button>
            </div>
          </div>

          {campaigns.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaña</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Presupuesto</TableHead>
                      <TableHead>Gastado</TableHead>
                      <TableHead>Impresiones</TableHead>
                      <TableHead>CTR</TableHead>
                      <TableHead>CPC</TableHead>
                      <TableHead>Quality Score</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-sm text-muted-foreground">Creada: {campaign.created}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(campaign.type)}
                            <span className="text-sm">{campaignTypes.find(t => t.value === campaign.type)?.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>${campaign.budget}</TableCell>
                        <TableCell>${campaign.spent}</TableCell>
                        <TableCell>{campaign.impressions}</TableCell>
                        <TableCell>{campaign.ctr}</TableCell>
                        <TableCell>{campaign.cpc}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${getQualityScoreColor(campaign.qualityScore)}`}>
                            {campaign.qualityScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No tienes campañas activas</h3>
                <p className="text-muted-foreground mb-4">
                  Crea tu primera campaña de Google Ads para comenzar a promocionar tu automotora.
                </p>
                <Button onClick={() => setActiveTab("create")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Campaña
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Crear Campaña */}
        <TabsContent value="create" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Configuración de Campaña
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="campaignName">Nombre de la Campaña</Label>
                  <Input
                    id="campaignName"
                    placeholder="Autos Usados - Búsqueda - Marzo 2024"
                    value={formData.campaignName}
                    onChange={(e) => handleInputChange('campaignName', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="campaignType">Tipo de Campaña</Label>
                  <Select value={formData.campaignType} onValueChange={(value) => handleInputChange('campaignType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaignTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="budget">Presupuesto Diario</Label>
                  <Input
                    id="budget"
                    placeholder="100"
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="location">Ubicación</Label>
                  <Input
                    id="location"
                    placeholder="Santiago, Chile"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="language">Idioma</Label>
                  <Select value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-green-600" />
                  Palabras Clave
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="keywords">Palabras Clave</Label>
                  <Textarea
                    id="keywords"
                    placeholder="autos usados, vehículos usados, carros usados, automotora, venta de autos"
                    value={formData.keywords}
                    onChange={(e) => handleInputChange('keywords', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Separa las palabras clave con comas
                  </p>
                </div>

                <div>
                  <Label htmlFor="adGroupName">Nombre del Grupo de Anuncios</Label>
                  <Input
                    id="adGroupName"
                    placeholder="Autos Usados - General"
                    value={formData.adGroupName}
                    onChange={(e) => handleInputChange('adGroupName', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="finalUrl">URL Final</Label>
                  <Input
                    id="finalUrl"
                    placeholder="https://tuautomotora.cl/vehiculos-usados"
                    value={formData.finalUrl}
                    onChange={(e) => handleInputChange('finalUrl', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-purple-600" />
                Contenido del Anuncio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="headline1">Título 1</Label>
                  <Input
                    id="headline1"
                    placeholder="Autos Usados de Calidad"
                    value={formData.headline1}
                    onChange={(e) => handleInputChange('headline1', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="headline2">Título 2</Label>
                  <Input
                    id="headline2"
                    placeholder="Financiamiento Disponible"
                    value={formData.headline2}
                    onChange={(e) => handleInputChange('headline2', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="headline3">Título 3</Label>
                  <Input
                    id="headline3"
                    placeholder="Garantía Incluida"
                    value={formData.headline3}
                    onChange={(e) => handleInputChange('headline3', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="description1">Descripción 1</Label>
                  <Textarea
                    id="description1"
                    placeholder="Descubre nuestra amplia selección de vehículos usados con garantía. Calidad asegurada."
                    value={formData.description1}
                    onChange={(e) => handleInputChange('description1', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="description2">Descripción 2</Label>
                  <Textarea
                    id="description2"
                    placeholder="Financiamiento flexible, entrega inmediata y servicio post-venta. ¡Visítanos hoy!"
                    value={formData.description2}
                    onChange={(e) => handleInputChange('description2', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="callToAction">Llamada a la Acción</Label>
                <Select value={formData.callToAction} onValueChange={(value) => handleInputChange('callToAction', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona CTA" />
                  </SelectTrigger>
                  <SelectContent>
                    {callToActions.map((cta) => (
                      <SelectItem key={cta.value} value={cta.value}>
                        {cta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateCampaign}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Crear Campaña
                    </>
                  )}
                </Button>
                <Button variant="outline">
                  <Eye className="h-4 w-4 mr-2" />
                  Vista Previa
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Palabras Clave */}
        <TabsContent value="keywords" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                Gestión de Palabras Clave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Palabras Clave Principales</h3>
                      <Badge variant="outline">15 palabras</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">autos usados</span>
                        <Badge className="bg-green-100 text-green-800">Activa</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">vehículos usados</span>
                        <Badge className="bg-green-100 text-green-800">Activa</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">carros usados</span>
                        <Badge className="bg-yellow-100 text-yellow-800">Pausada</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Palabra
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Palabras Clave Negativas</h3>
                      <Badge variant="outline">8 palabras</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">gratis</span>
                        <Badge className="bg-red-100 text-red-800">Negativa</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">regalo</span>
                        <Badge className="bg-red-100 text-red-800">Negativa</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">barato</span>
                        <Badge className="bg-red-100 text-red-800">Negativa</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Negativa
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Sugerencias</h3>
                      <Badge variant="outline">12 sugerencias</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">automotora santiago</span>
                        <Badge className="bg-blue-100 text-blue-800">Nueva</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">financiamiento autos</span>
                        <Badge className="bg-blue-100 text-blue-800">Nueva</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">venta de vehículos</span>
                        <Badge className="bg-blue-100 text-blue-800">Nueva</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      <Filter className="h-4 w-4 mr-2" />
                      Ver Todas
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Extensiones */}
        <TabsContent value="extensions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Extensiones de Anuncios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <MapPin className="h-6 w-6 text-blue-600" />
                      <h3 className="font-semibold">Ubicación</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Muestra tu dirección y permite a los usuarios obtener direcciones
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Clock className="h-6 w-6 text-green-600" />
                      <h3 className="font-semibold">Horarios</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Muestra tus horarios de atención para que los clientes sepan cuándo visitarte
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Award className="h-6 w-6 text-purple-600" />
                      <h3 className="font-semibold">Ofertas</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Destaca promociones especiales y ofertas limitadas
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Impresiones</p>
                    <p className="text-2xl font-bold">125,430</p>
                  </div>
                  <Eye className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-xs text-green-600 mt-2">+15% vs mes anterior</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Clics</p>
                    <p className="text-2xl font-bold">8,920</p>
                  </div>
                  <MousePointer className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-xs text-green-600 mt-2">+22% vs mes anterior</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CTR</p>
                    <p className="text-2xl font-bold">7.1%</p>
                  </div>
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-xs text-green-600 mt-2">+6% vs mes anterior</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CPC</p>
                    <p className="text-2xl font-bold">$2.15</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-orange-600" />
                </div>
                <p className="text-xs text-red-600 mt-2">-3% vs mes anterior</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Rendimiento por Palabra Clave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center p-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Análisis de Palabras Clave</h3>
                <p className="text-muted-foreground">
                  Aquí se mostraría el análisis detallado del rendimiento de cada palabra clave
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


