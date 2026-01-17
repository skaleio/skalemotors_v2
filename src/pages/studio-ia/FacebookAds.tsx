import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Facebook, 
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
  Image,
  Video,
  MessageSquare
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
import { toast } from "@/hooks/use-toast";

export default function FacebookAds() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    campaignName: "",
    objective: "",
    budget: "",
    audience: "",
    ageRange: "",
    interests: "",
    location: "",
    adFormat: "",
    headline: "",
    description: "",
    callToAction: ""
  });

  const objectives = [
    { value: "traffic", label: "Tráfico al sitio web" },
    { value: "conversions", label: "Conversiones" },
    { value: "awareness", label: "Reconocimiento de marca" },
    { value: "engagement", label: "Interacción" },
    { value: "app_installs", label: "Instalaciones de app" },
    { value: "video_views", label: "Reproducciones de video" }
  ];

  const adFormats = [
    { value: "single_image", label: "Imagen única" },
    { value: "carousel", label: "Carrusel" },
    { value: "video", label: "Video" },
    { value: "slideshow", label: "Presentación de diapositivas" },
    { value: "collection", label: "Colección" }
  ];

  const callToActions = [
    { value: "learn_more", label: "Saber más" },
    { value: "shop_now", label: "Comprar ahora" },
    { value: "sign_up", label: "Registrarse" },
    { value: "download", label: "Descargar" },
    { value: "contact_us", label: "Contáctanos" },
    { value: "get_quote", label: "Solicitar cotización" }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateCampaign = async () => {
    setLoading(true);
    
    setTimeout(() => {
      const newCampaign = {
        id: `camp_${Date.now()}`,
        name: formData.campaignName,
        objective: formData.objective,
        status: "active",
        budget: formData.budget,
        spent: "0",
        impressions: "0",
        clicks: "0",
        ctr: "0%",
        cpc: "$0.00",
        conversions: "0",
        cpa: "$0.00",
        created: new Date().toLocaleDateString(),
        audience: formData.audience,
        adFormat: formData.adFormat
      };
      
      setCampaigns(prev => [...prev, newCampaign]);
      setLoading(false);
      
      // Reset form
      setFormData({
        campaignName: "",
        objective: "",
        budget: "",
        audience: "",
        ageRange: "",
        interests: "",
        location: "",
        adFormat: "",
        headline: "",
        description: "",
        callToAction: ""
      });
      
      toast({
        title: "¡Campaña creada!",
        description: "Tu campaña de Facebook Ads ha sido creada exitosamente.",
      });
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

  const getObjectiveIcon = (objective: string) => {
    switch (objective) {
      case "traffic": return <MousePointer className="h-4 w-4" />;
      case "conversions": return <Target className="h-4 w-4" />;
      case "awareness": return <Eye className="h-4 w-4" />;
      case "engagement": return <MessageSquare className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Facebook Ads</h1>
          <p className="text-muted-foreground">
            Crea y gestiona tus campañas publicitarias en Facebook e Instagram
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
          <TabsTrigger value="create">Crear Campaña</TabsTrigger>
          <TabsTrigger value="audiences">Audiencias</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Lista de Campañas */}
        <TabsContent value="campaigns" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Mis Campañas</h2>
            <Button onClick={() => setActiveTab("create")}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Campaña
            </Button>
          </div>

          {campaigns.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaña</TableHead>
                      <TableHead>Objetivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Presupuesto</TableHead>
                      <TableHead>Gastado</TableHead>
                      <TableHead>Impresiones</TableHead>
                      <TableHead>CTR</TableHead>
                      <TableHead>CPC</TableHead>
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
                            {getObjectiveIcon(campaign.objective)}
                            <span className="text-sm">{objectives.find(o => o.value === campaign.objective)?.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                        <TableCell>${campaign.budget}</TableCell>
                        <TableCell>${campaign.spent}</TableCell>
                        <TableCell>{campaign.impressions}</TableCell>
                        <TableCell>{campaign.ctr}</TableCell>
                        <TableCell>{campaign.cpc}</TableCell>
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
                  <Facebook className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No tienes campañas activas</h3>
                <p className="text-muted-foreground mb-4">
                  Crea tu primera campaña de Facebook Ads para comenzar a promocionar tu automotora.
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
                    placeholder="Promoción Autos Usados - Marzo 2024"
                    value={formData.campaignName}
                    onChange={(e) => handleInputChange('campaignName', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="objective">Objetivo</Label>
                  <Select value={formData.objective} onValueChange={(value) => handleInputChange('objective', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el objetivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {objectives.map((objective) => (
                        <SelectItem key={objective.value} value={objective.value}>
                          {objective.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="budget">Presupuesto Diario</Label>
                  <Input
                    id="budget"
                    placeholder="50"
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="adFormat">Formato del Anuncio</Label>
                  <Select value={formData.adFormat} onValueChange={(value) => handleInputChange('adFormat', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona formato" />
                    </SelectTrigger>
                    <SelectContent>
                      {adFormats.map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
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
                  <Users className="h-5 w-5 text-green-600" />
                  Audiencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="audience">Audiencia Personalizada</Label>
                  <Input
                    id="audience"
                    placeholder="Interesados en autos usados"
                    value={formData.audience}
                    onChange={(e) => handleInputChange('audience', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="ageRange">Rango de Edad</Label>
                  <Input
                    id="ageRange"
                    placeholder="25-55"
                    value={formData.ageRange}
                    onChange={(e) => handleInputChange('ageRange', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="interests">Intereses</Label>
                  <Textarea
                    id="interests"
                    placeholder="autos, vehículos, automotora, financiamiento..."
                    value={formData.interests}
                    onChange={(e) => handleInputChange('interests', e.target.value)}
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
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                Contenido del Anuncio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="headline">Título Principal</Label>
                <Input
                  id="headline"
                  placeholder="¡Encuentra tu auto ideal con las mejores ofertas!"
                  value={formData.headline}
                  onChange={(e) => handleInputChange('headline', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Descubre nuestra amplia selección de vehículos usados con garantía. Financiamiento disponible y entrega inmediata."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
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

        {/* Audiencias */}
        <TabsContent value="audiences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Audiencias Guardadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Interesados en Autos</h3>
                      <Badge variant="outline">2,500 personas</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Personas interesadas en comprar vehículos usados
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Target className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Financiamiento</h3>
                      <Badge variant="outline">1,800 personas</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Personas buscando financiamiento para vehículos
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Target className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Clientes Existentes</h3>
                      <Badge variant="outline">450 personas</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Base de datos de clientes para remarketing
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Target className="h-4 w-4" />
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
                    <p className="text-sm font-medium text-muted-foreground">Alcance Total</p>
                    <p className="text-2xl font-bold">45,230</p>
                  </div>
                  <Eye className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-xs text-green-600 mt-2">+12% vs mes anterior</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Clics</p>
                    <p className="text-2xl font-bold">2,340</p>
                  </div>
                  <MousePointer className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-xs text-green-600 mt-2">+8% vs mes anterior</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CTR</p>
                    <p className="text-2xl font-bold">5.2%</p>
                  </div>
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-xs text-red-600 mt-2">-2% vs mes anterior</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CPC</p>
                    <p className="text-2xl font-bold">$1.85</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-orange-600" />
                </div>
                <p className="text-xs text-green-600 mt-2">-5% vs mes anterior</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Rendimiento por Campaña
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center p-8">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Gráfico de Rendimiento</h3>
                <p className="text-muted-foreground">
                  Aquí se mostraría el gráfico de rendimiento de tus campañas
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


