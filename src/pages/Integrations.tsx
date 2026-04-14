import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CheckCircle, XCircle, Settings, Loader2, BarChart3, Key, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  getMetaAdsStatus,
  connectMetaAds,
  disconnectMetaAds,
} from "@/lib/services/metaAdsApi";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type LeadIngestKeyMeta = {
  id: string;
  label: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

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

  const n8nIngestUrl = (import.meta.env.VITE_N8N_LEAD_INGEST_URL as string | undefined)?.trim();
  const [n8nBranchId, setN8nBranchId] = useState("");
  const [n8nLabel, setN8nLabel] = useState("");
  const [n8nMintOpen, setN8nMintOpen] = useState(false);
  const [n8nRevealOpen, setN8nRevealOpen] = useState(false);
  const [n8nRevealedKey, setN8nRevealedKey] = useState<string | null>(null);
  const [n8nMinting, setN8nMinting] = useState(false);
  const [n8nRevokeId, setN8nRevokeId] = useState<string | null>(null);

  const { data: branchRows = [] } = useQuery({
    queryKey: ["integrations-branches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (n8nBranchId || branchRows.length === 0) return;
    const preferred =
      user?.branch_id && branchRows.some((b) => b.id === user.branch_id)
        ? user.branch_id
        : branchRows[0]?.id;
    if (preferred) setN8nBranchId(preferred);
  }, [branchRows, n8nBranchId, user?.branch_id]);

  useEffect(() => {
    if (!n8nBranchId || branchRows.length === 0) return;
    if (!branchRows.some((b) => b.id === n8nBranchId)) {
      const fallback =
        (user?.branch_id && branchRows.some((b) => b.id === user.branch_id) && user.branch_id) ||
        branchRows[0]?.id ||
        "";
      setN8nBranchId(fallback);
    }
  }, [branchRows, n8nBranchId, user?.branch_id]);

  const { data: n8nKeys = [], isLoading: n8nKeysLoading } = useQuery({
    queryKey: ["lead-ingest-keys", n8nBranchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_lead_ingest_keys", {
        p_branch_id: n8nBranchId,
      });
      if (error) throw error;
      if (!Array.isArray(data)) return [];
      return data as LeadIngestKeyMeta[];
    },
    enabled: !!n8nBranchId,
  });

  const handleMintN8nKey = async () => {
    if (!n8nBranchId) {
      toast.error("Selecciona una sucursal.");
      return;
    }
    setN8nMinting(true);
    try {
      const { data, error } = await supabase.rpc("mint_lead_ingest_key", {
        p_branch_id: n8nBranchId,
        p_label: n8nLabel.trim() || undefined,
      });
      if (error) throw error;
      const row = data as { api_key?: string } | null;
      if (!row?.api_key) throw new Error("No se recibió la clave");
      setN8nRevealedKey(row.api_key);
      setN8nMintOpen(false);
      setN8nRevealOpen(true);
      setN8nLabel("");
      queryClient.invalidateQueries({ queryKey: ["lead-ingest-keys", n8nBranchId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setN8nMinting(false);
    }
  };

  const handleRevokeN8nKey = async () => {
    if (!n8nRevokeId || !n8nBranchId) return;
    try {
      const { data, error } = await supabase.rpc("revoke_lead_ingest_key", {
        p_key_id: n8nRevokeId,
      });
      if (error) throw error;
      const r = data as { ok?: boolean; error?: string };
      if (r?.ok === false) toast.error("No se encontró la clave.");
      else toast.success("Clave revocada.");
      setN8nRevokeId(null);
      queryClient.invalidateQueries({ queryKey: ["lead-ingest-keys", n8nBranchId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

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
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5 text-amber-600" />
                  API para ingesta de leads (n8n)
                </CardTitle>
                <CardDescription className="mt-1 max-w-3xl">
                  Genera claves por sucursal para el header <code className="text-xs">x-api-key</code> en
                  n8n u otros automatismos. El cuerpo JSON del POST debe incluir{" "}
                  <code className="text-xs">branch_id</code> de la misma sucursal que la clave. La clave
                  completa solo se muestra una vez al crearla.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user ? (
              <p className="text-sm text-muted-foreground">Cargando usuario…</p>
            ) : branchRows.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-100">
                No hay sucursales visibles para tu cuenta. Si necesitas una sucursal, créala o pídele a un
                administrador en{" "}
                <Link to="/app/settings" className="underline font-medium">
                  Configuración
                </Link>
                .
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sucursal</Label>
                    <Select value={n8nBranchId} onValueChange={setN8nBranchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona sucursal" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchRows.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>URL del endpoint (POST)</Label>
                    {n8nIngestUrl ? (
                      <div className="flex gap-2">
                        <Input readOnly value={n8nIngestUrl} className="font-mono text-xs" />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            void navigator.clipboard.writeText(n8nIngestUrl);
                            toast.success("URL copiada.");
                          }}
                          aria-label="Copiar URL"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                        Define{" "}
                        <code className="text-xs">VITE_N8N_LEAD_INGEST_URL</code> en el entorno del
                        frontend (URL completa del endpoint, p. ej.{" "}
                        <span className="whitespace-nowrap">
                          https://tu-dominio.vercel.app/api/n8n-lead-ingest
                        </span>
                        ).
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Dialog open={n8nMintOpen} onOpenChange={setN8nMintOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" disabled={!n8nBranchId}>
                        <Key className="h-4 w-4 mr-2" />
                        Generar clave
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Nueva clave API</DialogTitle>
                        <DialogDescription>
                          Opcional: un nombre para identificarla en la lista (p. ej. &quot;n8n
                          WhatsApp&quot;).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-2 py-2">
                        <Label htmlFor="n8n-key-label">Etiqueta</Label>
                        <Input
                          id="n8n-key-label"
                          value={n8nLabel}
                          onChange={(e) => setN8nLabel(e.target.value)}
                          placeholder="n8n"
                          autoComplete="off"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setN8nMintOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="button" onClick={() => void handleMintN8nKey()} disabled={n8nMinting}>
                          {n8nMinting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Crear
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <Dialog
                  open={n8nRevealOpen}
                  onOpenChange={(open) => {
                    setN8nRevealOpen(open);
                    if (!open) setN8nRevealedKey(null);
                  }}
                >
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Guarda esta clave ahora</DialogTitle>
                      <DialogDescription>
                        No podrás volver a verla. Configúrala en n8n como header{" "}
                        <code className="text-xs">x-api-key</code>.
                      </DialogDescription>
                    </DialogHeader>
                    {n8nRevealedKey ? (
                      <div className="flex gap-2">
                        <Input readOnly className="font-mono text-xs" value={n8nRevealedKey} />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            void navigator.clipboard.writeText(n8nRevealedKey);
                            toast.success("Clave copiada.");
                          }}
                          aria-label="Copiar clave"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                    <DialogFooter>
                      <Button type="button" onClick={() => setN8nRevealOpen(false)}>
                        Entendido
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog
                  open={!!n8nRevokeId}
                  onOpenChange={(open) => {
                    if (!open) setN8nRevokeId(null);
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Revocar esta clave?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Los flujos que usen esta clave dejarán de poder crear leads hasta que configures
                        una clave nueva.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => void handleRevokeN8nKey()}
                      >
                        Revocar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="rounded-md border">
                  <div className="border-b px-3 py-2 text-sm font-medium">Claves</div>
                  {n8nKeysLoading ? (
                    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando…
                    </div>
                  ) : n8nKeys.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No hay claves para esta sucursal. Genera una para usar en n8n.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {n8nKeys.map((k) => {
                        const active = !k.revoked_at;
                        return (
                          <li
                            key={k.id}
                            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <div className="font-medium">{k.label || "—"}</div>
                              <div className="text-xs text-muted-foreground">
                                Creada: {new Date(k.created_at).toLocaleString("es-CL")}
                                {k.last_used_at
                                  ? ` · \u00DAltimo uso: ${new Date(k.last_used_at).toLocaleString("es-CL")}`
                                  : ""}
                                {k.revoked_at
                                  ? ` · Revocada: ${new Date(k.revoked_at).toLocaleString("es-CL")}`
                                  : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {active ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                                  Activa
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Revocada</Badge>
                              )}
                              {active ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={() => setN8nRevokeId(k.id)}
                                >
                                  Revocar
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
              <CardTitle className="text-lg">Meta WhatsApp Business</CardTitle>
              <Badge variant="outline">No conectado</Badge>
            </div>
            <CardDescription>
              Mensajería WhatsApp vía API oficial de Meta
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
