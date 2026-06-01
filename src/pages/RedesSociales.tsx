import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Link2, Megaphone, Unlink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  canConnectOrg,
  showOrgTab,
  type ZernioScope,
} from "@/lib/zernio/rbac";
import { ZERNIO_PLATFORMS } from "@/lib/zernio/platforms";
import {
  createZernioPost,
  disconnectZernioAccount,
  getZernioConnectUrl,
  listZernioAccounts,
  listZernioPosts,
  type ZernioAccountRow,
} from "@/lib/services/zernioApi";
import { toast } from "sonner";

function ScopePanel({ scope, label }: { scope: ZernioScope; label: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const canConnect = scope === "org" ? canConnectOrg(user?.role) : true;

  const accountsQuery = useQuery({
    queryKey: ["zernio-accounts", scope],
    queryFn: () => listZernioAccounts(scope),
  });

  const postsQuery = useQuery({
    queryKey: ["zernio-posts", scope],
    queryFn: () => listZernioPosts(scope),
  });

  const accounts = accountsQuery.data ?? [];

  const toggleAccount = (accountId: string, checked: boolean) => {
    setSelectedAccountIds((prev) =>
      checked ? [...prev, accountId] : prev.filter((id) => id !== accountId),
    );
  };

  const handleConnect = async (platform: string) => {
    setConnectingPlatform(platform);
    try {
      sessionStorage.setItem("zernio_connect_scope", scope);
      const redirectUrl = `${window.location.origin}/app/redes-sociales/callback`;
      const { authUrl } = await getZernioConnectUrl(scope, platform, redirectUrl);
      window.location.href = authUrl;
    } catch (e) {
      toast.error((e as Error).message);
      setConnectingPlatform(null);
    }
  };

  const handleDisconnect = async (account: ZernioAccountRow) => {
    setDisconnectingId(account.zernio_account_id);
    try {
      await disconnectZernioAccount(scope, account.zernio_account_id);
      toast.success("Cuenta desconectada.");
      queryClient.invalidateQueries({ queryKey: ["zernio-accounts", scope] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDisconnectingId(null);
    }
  };

  const handlePublish = async (publishNow: boolean) => {
    if (!content.trim()) {
      toast.error("Escribe el contenido del post.");
      return;
    }
    const selected = accounts.filter((a) => selectedAccountIds.includes(a.zernio_account_id));
    if (!selected.length) {
      toast.error("Selecciona al menos una cuenta.");
      return;
    }
    if (!publishNow && !scheduledFor.trim()) {
      toast.error("Indica fecha y hora para programar, o usa Publicar ahora.");
      return;
    }

    setPublishing(true);
    try {
      await createZernioPost({
        scope,
        content: content.trim(),
        platforms: selected.map((a) => ({
          platform: a.platform,
          accountId: a.zernio_account_id,
        })),
        publishNow,
        scheduledFor: publishNow ? undefined : new Date(scheduledFor).toISOString(),
      });
      toast.success(publishNow ? "Publicación enviada." : "Post programado.");
      setContent("");
      setScheduledFor("");
      setSelectedAccountIds([]);
      queryClient.invalidateQueries({ queryKey: ["zernio-posts", scope] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Cuentas — {label}
          </CardTitle>
          <CardDescription>
            {canConnect
              ? "Conecta tus redes con OAuth. Las credenciales no se guardan en Skale."
              : "Puedes publicar en las cuentas ya conectadas por un administrador."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canConnect && (
            <div className="flex flex-wrap gap-2">
              {ZERNIO_PLATFORMS.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  disabled={!!connectingPlatform}
                  onClick={() => handleConnect(p.id)}
                >
                  {connectingPlatform === p.id && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Conectar {p.label}
                </Button>
              ))}
            </div>
          )}

          {accountsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando cuentas…
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cuentas conectadas en este ámbito.</p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedAccountIds.includes(account.zernio_account_id)}
                      onCheckedChange={(v) =>
                        toggleAccount(account.zernio_account_id, v === true)
                      }
                    />
                    <div>
                      <p className="font-medium capitalize">{account.platform}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.display_name || account.username || account.zernio_account_id}
                      </p>
                    </div>
                  </div>
                  {canConnect && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disconnectingId === account.zernio_account_id}
                      onClick={() => handleDisconnect(account)}
                    >
                      {disconnectingId === account.zernio_account_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="mr-1 h-4 w-4" />
                      )}
                      Desconectar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5" />
            Nuevo post — {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`content-${scope}`}>Contenido</Label>
            <Textarea
              id={`content-${scope}`}
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe el mensaje para tus redes…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`schedule-${scope}`}>Programar (opcional)</Label>
            <Input
              id={`schedule-${scope}`}
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={publishing} onClick={() => handlePublish(true)}>
              {publishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publicar ahora
            </Button>
            <Button variant="secondary" disabled={publishing} onClick={() => handlePublish(false)}>
              Programar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historial reciente</CardTitle>
        </CardHeader>
        <CardContent>
          {postsQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : !postsQuery.data?.length ? (
            <p className="text-sm text-muted-foreground">Sin publicaciones aún.</p>
          ) : (
            <ul className="space-y-3">
              {postsQuery.data.map((post) => (
                <li key={post.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{post.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.created_at).toLocaleString("es-CL")}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RedesSociales() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgVisible = showOrgTab(user?.role);
  const defaultTab: ZernioScope = orgVisible ? "org" : "personal";
  const tabParam = searchParams.get("tab");
  const activeTab: ZernioScope =
    tabParam === "org" && orgVisible ? "org" : tabParam === "personal" ? "personal" : defaultTab;

  const tabs = useMemo(() => {
    const list: { value: ZernioScope; label: string }[] = [];
    if (orgVisible) list.push({ value: "org", label: "Automotora" });
    list.push({ value: "personal", label: "Mis cuentas" });
    return list;
  }, [orgVisible]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Redes sociales</h1>
        <p className="text-muted-foreground">
          Conecta cuentas y publica en redes vía Zernio. La automotora y tus cuentas personales
          están separadas.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setSearchParams({ tab: v })}
      >
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {orgVisible && (
          <TabsContent value="org">
            <ScopePanel scope="org" label="Automotora" />
          </TabsContent>
        )}
        <TabsContent value="personal">
          <ScopePanel scope="personal" label="Mis cuentas" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
