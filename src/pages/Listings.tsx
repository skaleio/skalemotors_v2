import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Globe, Plus, Search, RefreshCw, CheckCircle, XCircle, ExternalLink, Loader2, Facebook, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listConnections,
  listListingsWithVehicles,
  connectPlatform,
  syncAll,
  type MarketplaceConnectionRow,
  type MarketplacePlatform,
} from "@/lib/services/marketplaceApi";

// Logo de Facebook como componente SVG
const FacebookLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// Logo de Mercado Libre como componente SVG
const MercadoLibreLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="48" height="48" rx="8" fill="#FFE600"/>
    <path d="M24 8L16 20H20V32L24 28V20H28L24 8Z" fill="#2D3277"/>
    <path d="M28 28L32 24V32H28V28Z" fill="#2D3277"/>
  </svg>
);
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

type Platform = "chileautos" | "mercadolibre" | "facebook" | null;

type ListingWithVehicle = {
  id: string;
  vehicle_id: string;
  platform: string;
  external_id: string | null;
  external_url: string | null;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  vehicles: { id: string; make: string; model: string; year: number; vin: string; price: number; status: string } | null;
};

export default function Listings() {
  const { user } = useAuth();
  const branchId = user?.branch_id ?? null;

  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connections, setConnections] = useState<MarketplaceConnectionRow[]>([]);
  const [listings, setListings] = useState<ListingWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [chileautosConfig, setChileautosConfig] = useState({
    clientId: "",
    clientSecret: "",
    sellerIdentifier: "",
  });
  const [mercadolibreConfig, setMercadolibreConfig] = useState({ accessToken: "" });
  const [facebookConfig, setFacebookConfig] = useState({ productCatalogId: "", accessToken: "" });

  const fetchData = useCallback(async () => {
    if (!branchId) {
      setConnections([]);
      setListings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [conns, list] = await Promise.all([
        listConnections(branchId),
        listListingsWithVehicles(branchId),
      ]);
      setConnections(conns);
      setListings(list as ListingWithVehicle[]);
    } catch (e) {
      toast({
        title: "Error al cargar",
        description: e instanceof Error ? e.message : "No se pudieron cargar conexiones o publicaciones.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenPlatform = (platform: Platform) => {
    setSelectedPlatform(platform);
    setIsDialogOpen(true);
  };

  const handleConnect = async () => {
    if (!selectedPlatform || !branchId) return;
    setIsConnecting(true);
    try {
      let credentials: Record<string, string> = {};
      if (selectedPlatform === "chileautos") {
        credentials = {
          client_id: chileautosConfig.clientId,
          client_secret: chileautosConfig.clientSecret,
          seller_identifier: chileautosConfig.sellerIdentifier,
        };
      } else if (selectedPlatform === "mercadolibre") {
        credentials = { access_token: mercadolibreConfig.accessToken };
      } else {
        credentials = {
          access_token: facebookConfig.accessToken,
          catalog_id: facebookConfig.productCatalogId,
        };
      }
      await connectPlatform(selectedPlatform as MarketplacePlatform, branchId, credentials);
      const platformName =
        selectedPlatform === "chileautos" ? "Chileautos" : selectedPlatform === "mercadolibre" ? "Mercado Libre" : "Facebook Marketplace";
      toast({ title: "Conexión exitosa", description: `${platformName} conectado correctamente.` });
      setIsDialogOpen(false);
      setSelectedPlatform(null);
      setChileautosConfig({ clientId: "", clientSecret: "", sellerIdentifier: "" });
      setMercadolibreConfig({ accessToken: "" });
      setFacebookConfig({ productCatalogId: "", accessToken: "" });
      await fetchData();
    } catch (error) {
      toast({
        title: "Error de conexión",
        description: error instanceof Error ? error.message : "Verifica tus credenciales.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncAll = async () => {
    if (!branchId) return;
    setIsSyncing(true);
    try {
      const result = await syncAll(branchId);
      toast({
        title: "Sincronización completada",
        description: `Se publicaron ${result.synced} vehículo(s) en las plataformas conectadas.`,
      });
      if (result.errors?.length) {
        toast({
          title: "Algunos errores",
          description: `${result.errors.length} publicación(es) fallaron. Revisa la tabla.`,
          variant: "destructive",
        });
      }
      await fetchData();
    } catch (error) {
      toast({
        title: "Error al sincronizar",
        description: error instanceof Error ? error.message : "No se pudo sincronizar.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Publicaciones</h1>
          <p className="text-muted-foreground mt-2">
            Sincroniza y gestiona publicaciones en portales web
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSyncAll}
            disabled={!branchId || isSyncing || connections.length === 0}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar todo
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Globe className="h-4 w-4 mr-2" />
                Conectar plataformas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Conectar Plataforma</DialogTitle>
                <DialogDescription>
                  Selecciona y configura la plataforma donde deseas publicar tus vehículos
                </DialogDescription>
              </DialogHeader>

              {!selectedPlatform ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
                  {/* Chileautos */}
                  <Card 
                    className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all"
                    onClick={() => setSelectedPlatform("chileautos")}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Globe className="h-8 w-8 text-blue-600" />
                        <Badge variant="outline">Portal</Badge>
                      </div>
                      <CardTitle className="text-xl">Chileautos</CardTitle>
                      <CardDescription>
                        Publica tu inventario en el portal líder de vehículos en Chile
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Sincronización automática
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Gestión de publicaciones
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Estadísticas de visitas
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Mercado Libre */}
                  <Card 
                    className="cursor-pointer hover:border-yellow-500 hover:shadow-lg transition-all"
                    onClick={() => setSelectedPlatform("mercadolibre")}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Globe className="h-8 w-8 text-yellow-600" />
                        <Badge variant="outline">Marketplace</Badge>
                      </div>
                      <CardTitle className="text-xl">Mercado Libre</CardTitle>
                      <CardDescription>
                        Vende tus vehículos en el marketplace más grande de Latinoamérica
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Publicación automática
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Gestión de stock
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Mayor alcance
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Facebook Marketplace */}
                  <Card 
                    className="cursor-pointer hover:border-[#1877F2] hover:shadow-lg transition-all"
                    onClick={() => setSelectedPlatform("facebook")}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <FacebookLogo className="h-8 w-8 text-[#1877F2]" />
                        <Badge variant="outline">Social</Badge>
                      </div>
                      <CardTitle className="text-xl">Facebook Marketplace</CardTitle>
                      <CardDescription>
                        Alcanza millones de compradores en Facebook
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Audiencia masiva
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          API de productos
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Gestión de catálogo
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="space-y-6 py-4">
                  {/* Configuración de Chileautos */}
                  {selectedPlatform === "chileautos" && (
                    <>
                      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                        <Globe className="h-8 w-8 text-blue-600" />
                        <div>
                          <h3 className="font-semibold text-lg">Chileautos</h3>
                          <p className="text-sm text-muted-foreground">
                            Configura tu conexión con Chileautos
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Client ID *
                          </label>
                          <Input
                            placeholder="464f4235-8052-4832-a5ea-6738021263fe"
                            value={chileautosConfig.clientId}
                            onChange={(e) => setChileautosConfig({
                              ...chileautosConfig,
                              clientId: e.target.value
                            })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Tu Client ID de la API de Chileautos
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Client Secret *
                          </label>
                          <Input
                            type="password"
                            placeholder="Cen/5ic8fYtGbHMD4lU8VYHZ5/sJsU/N4qrl9V2DIzU="
                            value={chileautosConfig.clientSecret}
                            onChange={(e) => setChileautosConfig({
                              ...chileautosConfig,
                              clientSecret: e.target.value
                            })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Tu Secret Key de la API
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Seller Identifier *
                          </label>
                          <Input
                            placeholder="05e8ed1b-1355-4486-a6a2-a043959edff9"
                            value={chileautosConfig.sellerIdentifier}
                            onChange={(e) => setChileautosConfig({
                              ...chileautosConfig,
                              sellerIdentifier: e.target.value
                            })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Tu identificador de vendedor
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <a
                            href="https://www.chileautos.cl/staticpages/global-inventory-integration"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-blue-600 hover:underline">
                              Ver guía de integración
                            </span>
                          </a>
                          <button
                            onClick={() => {
                              toast({
                                title: "Chat de soporte",
                                description: "Haz clic en el botón flotante de la esquina inferior derecha para chatear con soporte.",
                              });
                            }}
                            className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">
                              Contactar soporte
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Configuración de Mercado Libre */}
                  {selectedPlatform === "mercadolibre" && (
                    <>
                      <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                        <Globe className="h-8 w-8 text-yellow-600" />
                        <div>
                          <h3 className="font-semibold text-lg">Mercado Libre</h3>
                          <p className="text-sm text-muted-foreground">
                            Configura tu conexión con Mercado Libre
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Access Token *
                          </label>
                          <Input
                            type="password"
                            placeholder="APP_USR-XXXXXXXXXXXX-XXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX"
                            value={mercadolibreConfig.accessToken}
                            onChange={(e) => setMercadolibreConfig({
                              ...mercadolibreConfig,
                              accessToken: e.target.value
                            })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Tu token de acceso de Mercado Libre
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <a
                            href="https://developers.mercadolibre.cl/es_ar/mcp-server"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-blue-600 hover:underline">
                              Ver guía de integración
                            </span>
                          </a>
                          <button
                            onClick={() => {
                              toast({
                                title: "Chat de soporte",
                                description: "Haz clic en el botón flotante de la esquina inferior derecha para chatear con soporte.",
                              });
                            }}
                            className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">
                              Contactar soporte
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Configuración de Facebook Marketplace */}
                  {selectedPlatform === "facebook" && (
                    <>
                      <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                        <FacebookLogo className="h-8 w-8 text-[#1877F2]" />
                        <div>
                          <h3 className="font-semibold text-lg">Facebook Marketplace</h3>
                          <p className="text-sm text-muted-foreground">
                            Configura tu conexión con Facebook Marketplace
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Product Catalog ID *
                          </label>
                          <Input
                            placeholder="1234567890123456"
                            value={facebookConfig.productCatalogId}
                            onChange={(e) => setFacebookConfig({
                              ...facebookConfig,
                              productCatalogId: e.target.value
                            })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            El ID de tu catálogo de productos en Facebook
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Access Token *
                          </label>
                          <Input
                            type="password"
                            placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={facebookConfig.accessToken}
                            onChange={(e) => setFacebookConfig({
                              ...facebookConfig,
                              accessToken: e.target.value
                            })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Tu token de acceso de la API de Facebook
                          </p>
                        </div>

                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-blue-600" />
                            Requisitos de la API
                          </h4>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                            <li>• Máximo 30 llamadas por minuto</li>
                            <li>• Hasta 300 productos por lote</li>
                            <li>• Imágenes mínimo 500x500px (JPEG/PNG)</li>
                            <li>• Formato de precio: "100 USD"</li>
                          </ul>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <a
                            href="https://developers.facebook.com/docs/marketplace/partnerships/itemAPI"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-blue-600 hover:underline">
                              Ver documentación API
                            </span>
                          </a>
                          <button
                            onClick={() => {
                              toast({
                                title: "Chat de soporte",
                                description: "Haz clic en el botón flotante de la esquina inferior derecha para chatear con soporte.",
                              });
                            }}
                            className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-green-600">
                              Contactar soporte
                            </span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Botones de acción */}
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedPlatform(null)}
                      disabled={isConnecting}
                    >
                      Volver
                    </Button>
                    <Button
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="flex-1"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Conectar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Publicación
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Publicadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : listings.filter((l) => l.status === "published").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Cargando..." : "En portales activas"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conexiones</CardTitle>
            <Globe className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : connections.filter((c) => c.status === "active").length}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Cargando..." : "Plataformas conectadas"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Error</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : listings.filter((l) => l.status === "error").length}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Cargando..." : "Publicaciones fallidas"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar publicaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Publicaciones
          </CardTitle>
          <CardDescription>
            Lista de publicaciones en Mercado Libre, Facebook y Chile Autos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Fecha publicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : !branchId ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No tienes sucursal asignada
                  </TableCell>
                </TableRow>
              ) : listings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay publicaciones. Conecta una plataforma y usa &quot;Sincronizar todo&quot; o publica desde Inventario.
                  </TableCell>
                </TableRow>
              ) : (
                listings
                  .filter((l) => !searchQuery || `${(l.vehicles?.make ?? "")} ${l.vehicles?.model ?? ""} ${l.vehicles?.year ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.vehicles
                          ? `${row.vehicles.make} ${row.vehicles.model} ${row.vehicles.year}`
                          : row.vehicle_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {row.platform === "mercadolibre" ? "Mercado Libre" : row.platform === "facebook" ? "Facebook" : "Chile Autos"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.last_synced_at
                          ? new Date(row.last_synced_at).toLocaleDateString("es-CL", { dateStyle: "short" })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={row.status === "published" ? "default" : row.status === "error" ? "destructive" : "secondary"}
                        >
                          {row.status === "published" ? "Publicado" : row.status === "error" ? "Error" : row.status}
                        </Badge>
                        {row.last_error && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={row.last_error}>
                            {row.last_error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.external_url && (
                          <a
                            href={row.external_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Ver
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
