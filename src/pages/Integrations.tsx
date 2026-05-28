import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
import { CheckCircle, XCircle, Settings, Loader2, BarChart3, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LeadIngestApiKeysSection } from "@/components/settings/LeadIngestApiKeysSection";
import {
  getMetaAdsStatus,
  connectMetaAds,
  disconnectMetaAds,
} from "@/lib/services/metaAdsApi";
import {
  getWhatsAppStatus,
  connectWhatsApp,
  disconnectWhatsApp,
} from "@/lib/services/whatsappApi";
import {
  getYCloudStatus,
  connectYCloud,
  disconnectYCloud,
} from "@/lib/services/ycloudApi";
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

  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [waDisconnectOpen, setWaDisconnectOpen] = useState(false);
  const [waAccessToken, setWaAccessToken] = useState("");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waWabaId, setWaWabaId] = useState("");
  const [waConnecting, setWaConnecting] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);

  const [ycDialogOpen, setYcDialogOpen] = useState(false);
  const [ycDisconnectOpen, setYcDisconnectOpen] = useState(false);
  const [ycApiKey, setYcApiKey] = useState("");
  const [ycPhoneNumberId, setYcPhoneNumberId] = useState("");
  const [ycDisplayNumber, setYcDisplayNumber] = useState("");
  const [ycConnecting, setYcConnecting] = useState(false);
  const [ycDisconnecting, setYcDisconnecting] = useState(false);

  const { data: metaAdsStatus, isLoading: metaAdsStatusLoading } = useQuery({
    queryKey: ["meta-ads-status", branchId],
    queryFn: () => getMetaAdsStatus(branchId!),
    enabled: !!branchId,
  });

  const { data: whatsAppStatus, isLoading: whatsAppStatusLoading } = useQuery({
    queryKey: ["whatsapp-status", branchId],
    queryFn: () => getWhatsAppStatus(branchId!),
    enabled: !!branchId,
  });

  const { data: ycloudStatus, isLoading: ycloudStatusLoading } = useQuery({
    queryKey: ["ycloud-status", branchId],
    queryFn: () => getYCloudStatus(branchId!),
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

  const handleConnectWhatsApp = async () => {
    if (!branchId || !waAccessToken.trim() || !waPhoneNumberId.trim()) {
      toast.error("Ingresa el token de Meta y el Phone Number ID.");
      return;
    }
    setWaConnecting(true);
    try {
      await connectWhatsApp(branchId, {
        accessToken: waAccessToken.trim(),
        phoneNumberId: waPhoneNumberId.trim(),
        wabaId: waWabaId.trim() || undefined,
      });
      toast.success("WhatsApp conectado correctamente.");
      setWaDialogOpen(false);
      setWaAccessToken("");
      setWaPhoneNumberId("");
      setWaWabaId("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", branchId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWaConnecting(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!branchId) return;
    setWaDisconnecting(true);
    try {
      await disconnectWhatsApp(branchId);
      toast.success("WhatsApp desconectado.");
      setWaDisconnectOpen(false);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", branchId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWaDisconnecting(false);
    }
  };

  const handleConnectYCloud = async () => {
    if (!branchId || !ycApiKey.trim() || !ycPhoneNumberId.trim()) {
      toast.error("Ingresa la API key de YCloud y el Phone Number ID.");
      return;
    }
    setYcConnecting(true);
    try {
      const res = await connectYCloud(branchId, {
        apiKey: ycApiKey.trim(),
        phoneNumberId: ycPhoneNumberId.trim(),
        displayNumber: ycDisplayNumber.trim() || undefined,
      });
      toast.success(res.message || "YCloud conectado correctamente.");
      if (res.webhook_warning) {
        toast.warning(res.webhook_warning);
      }
      setYcDialogOpen(false);
      setYcApiKey("");
      setYcPhoneNumberId("");
      setYcDisplayNumber("");
      queryClient.invalidateQueries({ queryKey: ["ycloud-status", branchId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status", branchId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setYcConnecting(false);
    }
  };

  const handleDisconnectYCloud = async () => {
    if (!branchId) return;
    setYcDisconnecting(true);
    try {
      await disconnectYCloud(branchId, false);
      toast.success("YCloud desconectado.");
      setYcDisconnectOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ycloud-status", branchId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setYcDisconnecting(false);
    }
  };

  const metaConnected = metaAdsStatus?.connected ?? false;
  const waConnected = whatsAppStatus?.connected ?? false;
  const ycConnected = ycloudStatus?.connected ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-muted-foreground mt-2">
          Conecta tu automotora con servicios externos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-3">
          <LeadIngestApiKeysSection />
        </div>

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
                  <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Ver campañas y métricas
                  </a>
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
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                WhatsApp Business (Meta)
              </CardTitle>
              {whatsAppStatusLoading ? (
                <Badge variant="outline">Cargando...</Badge>
              ) : waConnected ? (
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
              Conecta el número de tu sucursal vía API oficial de Meta. Cada automotora usa su propio token.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {waConnected && whatsAppStatus?.display_number ? (
              <p className="text-sm text-muted-foreground">
                Número: {whatsAppStatus.display_number}
              </p>
            ) : null}
            {waConnected ? (
              <>
                <AlertDialog open={waDisconnectOpen} onOpenChange={setWaDisconnectOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar WhatsApp</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dejarás de enviar y recibir mensajes en la app hasta volver a conectar con Meta.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnectWhatsApp}
                        disabled={waDisconnecting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {waDisconnecting ? (
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
                  onClick={() => setWaDisconnectOpen(true)}
                  disabled={waDisconnecting}
                >
                  Desconectar
                </Button>
              </>
            ) : (
              <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Conectar WhatsApp
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Conectar WhatsApp (Meta)</DialogTitle>
                    <DialogDescription>
                      {branchId
                        ? "Desde Meta for Developers: token del System User con permisos de WhatsApp y el Phone Number ID del número registrado en tu WABA."
                        : "Tu usuario debe tener una sucursal asignada para conectar WhatsApp."}
                    </DialogDescription>
                  </DialogHeader>
                  {!branchId ? (
                    <div className="space-y-4 py-4">
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
                        Asigna una sucursal en Configuración antes de conectar WhatsApp.
                      </div>
                      <Button asChild className="w-full" onClick={() => setWaDialogOpen(false)}>
                        <Link to="/app/settings">
                          <Settings className="h-4 w-4 mr-2" />
                          Ir a Configuración
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="wa-access-token">Token de acceso Meta *</Label>
                        <Input
                          id="wa-access-token"
                          type="password"
                          placeholder="EAAxxxx..."
                          value={waAccessToken}
                          onChange={(e) => setWaAccessToken(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="wa-phone-number-id">Phone Number ID *</Label>
                        <Input
                          id="wa-phone-number-id"
                          placeholder="ID del número en WhatsApp Manager"
                          value={waPhoneNumberId}
                          onChange={(e) => setWaPhoneNumberId(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="wa-waba-id">WABA ID (opcional)</Label>
                        <Input
                          id="wa-waba-id"
                          placeholder="WhatsApp Business Account ID"
                          value={waWabaId}
                          onChange={(e) => setWaWabaId(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setWaDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleConnectWhatsApp} disabled={waConnecting || !branchId}>
                      {waConnecting ? (
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
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" />
                WhatsApp vía YCloud
              </CardTitle>
              {ycloudStatusLoading ? (
                <Badge variant="outline">Cargando...</Badge>
              ) : ycConnected ? (
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
              Recomendado para piloto con coexistencia (app WhatsApp Business + API). Cada automotora usa su API key YCloud.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ycloudStatus?.webhook_url ? (
              <p className="text-xs text-muted-foreground break-all">
                Webhook: {ycloudStatus.webhook_url}
                {ycloudStatus.webhook_configured ? " (registrado)" : " (pendiente)"}
              </p>
            ) : null}
            {ycConnected && ycloudStatus?.display_number ? (
              <p className="text-sm text-muted-foreground">
                Número: {ycloudStatus.display_number}
              </p>
            ) : null}
            {ycConnected ? (
              <>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/app/whatsapp">Abrir bandeja WhatsApp</Link>
                </Button>
                <AlertDialog open={ycDisconnectOpen} onOpenChange={setYcDisconnectOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar YCloud</AlertDialogTitle>
                      <AlertDialogDescription>
                        La sucursal dejará de recibir mensajes vía YCloud hasta volver a conectar.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnectYCloud}
                        disabled={ycDisconnecting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {ycDisconnecting ? (
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
                  onClick={() => setYcDisconnectOpen(true)}
                  disabled={ycDisconnecting}
                >
                  Desconectar
                </Button>
              </>
            ) : (
              <Dialog open={ycDialogOpen} onOpenChange={setYcDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Conectar YCloud
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Conectar WhatsApp (YCloud)</DialogTitle>
                    <DialogDescription>
                      {branchId
                        ? "API key desde YCloud Developers y el Phone Number ID del número en tu cuenta. El webhook se registra automáticamente en Skale."
                        : "Asigna una sucursal en Configuración antes de conectar."}
                    </DialogDescription>
                  </DialogHeader>
                  {!branchId ? (
                    <div className="space-y-4 py-4">
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
                        Asigna una sucursal en Configuración antes de conectar YCloud.
                      </div>
                      <Button asChild className="w-full" onClick={() => setYcDialogOpen(false)}>
                        <Link to="/app/settings">
                          <Settings className="h-4 w-4 mr-2" />
                          Ir a Configuración
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="yc-api-key">API key YCloud *</Label>
                        <Input
                          id="yc-api-key"
                          type="password"
                          placeholder="ycloud_..."
                          value={ycApiKey}
                          onChange={(e) => setYcApiKey(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="yc-phone-number-id">Phone Number ID *</Label>
                        <Input
                          id="yc-phone-number-id"
                          placeholder="ID del número en YCloud"
                          value={ycPhoneNumberId}
                          onChange={(e) => setYcPhoneNumberId(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="yc-display-number">Número visible (opcional)</Label>
                        <Input
                          id="yc-display-number"
                          placeholder="+56 9 ..."
                          value={ycDisplayNumber}
                          onChange={(e) => setYcDisplayNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setYcDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleConnectYCloud} disabled={ycConnecting || !branchId}>
                      {ycConnecting ? (
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
