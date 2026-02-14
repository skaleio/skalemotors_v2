import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle, XCircle, Settings, Loader2, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  getMetaAdsStatus,
  connectMetaAds,
  disconnectMetaAds,
} from "@/lib/services/metaAdsApi";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Integrations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const branchId = user?.branch_id ?? null;

  const [metaAdsDialogOpen, setMetaAdsDialogOpen] = useState(false);
  const [metaAdsDisconnectOpen, setMetaAdsDisconnectOpen] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [metaAdsConnecting, setMetaAdsConnecting] = useState(false);
  const [metaAdsDisconnecting, setMetaAdsDisconnecting] = useState(false);

  const { data: metaAdsStatus, isLoading: metaAdsStatusLoading } = useQuery({
    queryKey: ["meta-ads-status", branchId],
    queryFn: () => getMetaAdsStatus(branchId!),
    enabled: !!branchId,
  });

  const handleConnectMetaAds = async () => {
    if (!branchId || !accessToken.trim()) {
      toast.error("Ingresa el token de acceso de Meta.");
      return;
    }
    const rawAdAccount = adAccountId.trim();
    const isPlaceholder = !rawAdAccount || rawAdAccount === "act_123456789";
    setMetaAdsConnecting(true);
    try {
      await connectMetaAds(branchId, {
        accessToken: accessToken.trim(),
        adAccountId: isPlaceholder ? undefined : rawAdAccount,
      });
      toast.success("Meta Ads conectado correctamente.");
      setMetaAdsDialogOpen(false);
      setAccessToken("");
      setAdAccountId("");
      queryClient.invalidateQueries({ queryKey: ["meta-ads-status", branchId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns", branchId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-insights", branchId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMetaAdsConnecting(false);
    }
  };

  const handleDisconnectMetaAds = async () => {
    if (!branchId) return;
    setMetaAdsDisconnecting(true);
    try {
      await disconnectMetaAds(branchId);
      toast.success("Meta Ads desconectado.");
      setMetaAdsDisconnectOpen(false);
      queryClient.invalidateQueries({ queryKey: ["meta-ads-status", branchId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns", branchId] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-insights", branchId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMetaAdsDisconnecting(false);
    }
  };

  const metaConnected = metaAdsStatus?.connected ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-muted-foreground mt-2">
          Conecta tu automotora con servicios externos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Meta (Facebook/Instagram) Ads */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Meta (Facebook/Instagram) Ads
              </CardTitle>
              {metaAdsStatusLoading ? (
                <Badge variant="outline">Cargando...</Badge>
              ) : metaConnected ? (
                <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline">
                  <XCircle className="h-3 w-3 mr-1" />
                  No conectado
                </Badge>
              )}
            </div>
            <CardDescription>
              Ver métricas y campañas de Facebook e Instagram Ads en la app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {metaConnected ? (
              <>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/app/studio-ia/marketing/facebook-ads">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver campañas y métricas
                  </Link>
                </Button>
                <AlertDialog open={metaAdsDisconnectOpen} onOpenChange={setMetaAdsDisconnectOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar Meta Ads</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dejarás de ver las campañas y métricas de Meta en la app hasta que vuelvas a conectar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnectMetaAds}
                        disabled={metaAdsDisconnecting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {metaAdsDisconnecting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Desconectar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => setMetaAdsDisconnectOpen(true)}
                  disabled={metaAdsDisconnecting}
                >
                  Desconectar
                </Button>
              </>
            ) : (
              <Dialog open={metaAdsDialogOpen} onOpenChange={setMetaAdsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Conectar
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Conectar Meta Ads</DialogTitle>
                    <DialogDescription>
                      {branchId
                        ? "Obtén un token de acceso con permisos ads_read y ads_management desde Meta for Developers o Graph API Explorer. Opcionalmente indica el ID de la cuenta de anuncios (act_XXXX)."
                        : "Para conectar Meta Ads tu usuario debe tener una sucursal asignada."}
                    </DialogDescription>
                  </DialogHeader>
                  {!branchId ? (
                    <div className="space-y-4 py-4">
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
                        Tu usuario no tiene sucursal asignada. Asigna una en Configuración para poder conectar Meta Ads.
                      </div>
                      <Button asChild className="w-full" onClick={() => setMetaAdsDialogOpen(false)}>
                        <Link to="/app/settings">
                          <Settings className="h-4 w-4 mr-2" />
                          Ir a Configuración para asignar sucursal
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="meta-access-token">Token de acceso *</Label>
                        <Input
                          id="meta-access-token"
                          type="password"
                          placeholder="EAAxxxx..."
                          value={accessToken}
                          onChange={(e) => setAccessToken(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="meta-ad-account">ID cuenta de anuncios (opcional)</Label>
                        <Input
                          id="meta-ad-account"
                          placeholder="act_XXXX (opcional; dejar vacío si solo tienes una cuenta)"
                          value={adAccountId}
                          onChange={(e) => setAdAccountId(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMetaAdsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleConnectMetaAds}
                      disabled={metaAdsConnecting || !branchId}
                    >
                      {metaAdsConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Conectar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">WhatsApp Business</CardTitle>
              <Badge variant="outline">No conectado</Badge>
            </div>
            <CardDescription>
              Integración con WhatsApp para comunicación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">YCloud</CardTitle>
              <Badge variant="outline">No conectado</Badge>
            </div>
            <CardDescription>
              Sistema de telefonía y llamadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">SII (Chile)</CardTitle>
              <Badge variant="outline">No conectado</Badge>
            </div>
            <CardDescription>
              Integración con Servicio de Impuestos Internos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Portales Web</CardTitle>
              <Badge variant="outline">No conectado</Badge>
            </div>
            <CardDescription>
              Sincronización con portales de vehículos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Stripe</CardTitle>
              <Badge variant="outline">No conectado</Badge>
            </div>
            <CardDescription>
              Procesamiento de pagos en línea
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Google Analytics</CardTitle>
              <Badge variant="outline">No conectado</Badge>
            </div>
            <CardDescription>
              Análisis de tráfico web
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
