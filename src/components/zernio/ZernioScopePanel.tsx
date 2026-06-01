import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Megaphone,
  PlugZap,
  RefreshCw,
  Share2,
  Unlink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canConnectOrg, type ZernioScope } from "@/lib/zernio/rbac";
import { ZERNIO_PLATFORMS } from "@/lib/zernio/platforms";
import {
  createZernioPost,
  disconnectZernioAccount,
  getZernioConnectUrl,
  type ZernioAccountRow,
} from "@/lib/services/zernioApi";
import {
  useZernioAccounts,
  useZernioPosts,
  zernioAccountsQueryKey,
  zernioPostsQueryKey,
} from "@/hooks/useZernioAccounts";
import { toast } from "sonner";
import { redirectToZernioOAuth } from "@/lib/zernio/oauth";
import { cn } from "@/lib/utils";

const PLATFORM_ACCENT: Record<string, string> = {
  instagram: "from-pink-500/20 to-purple-600/20 border-pink-500/30",
  facebook: "from-blue-600/20 to-blue-400/20 border-blue-500/30",
  linkedin: "from-sky-600/20 to-blue-700/20 border-sky-500/30",
  tiktok: "from-zinc-500/20 to-zinc-300/20 border-zinc-400/30",
  twitter: "from-zinc-600/20 to-zinc-400/20 border-zinc-500/30",
  youtube: "from-red-600/20 to-red-400/20 border-red-500/30",
};

function platformInitial(platform: string): string {
  return platform.slice(0, 2).toUpperCase();
}

function AccountsCheckingLine() {
  return (
    <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      Verificando cuentas conectadas…
    </p>
  );
}

function ConnectPlatformGrid({
  connectingPlatform,
  disabled,
  onConnect,
  compact,
}: {
  connectingPlatform: string | null;
  disabled: boolean;
  onConnect: (platform: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        compact ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {ZERNIO_PLATFORMS.map((p) => {
        const isConnecting = connectingPlatform === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled || (!!connectingPlatform && !isConnecting)}
            onClick={() => onConnect(p.id)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-xl border bg-gradient-to-br p-4 text-left transition hover:border-primary/50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60",
              PLATFORM_ACCENT[p.id] ?? "from-muted/40 to-muted/10 border-border",
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/80 text-sm font-semibold uppercase">
              {platformInitial(p.id)}
            </span>
            <span className="font-medium">{p.label}</span>
            <span className="text-xs text-muted-foreground">
              {isConnecting ? "Abriendo OAuth…" : "Conectar cuenta"}
            </span>
            {isConnecting && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptyAccountsState({
  scope,
  label,
  canConnect,
  connectingPlatform,
  onConnect,
}: {
  scope: ZernioScope;
  label: string;
  canConnect: boolean;
  connectingPlatform: string | null;
  onConnect: (platform: string) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-6 md:p-8">
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <PlugZap className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">
          {scope === "org"
            ? "Conecta las redes de la automotora"
            : "Conecta tus redes personales"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {canConnect
            ? `Aún no hay cuentas en «${label}». Elige una red abajo para autorizar con OAuth. Skale no guarda tu contraseña.`
            : `No hay cuentas de automotora conectadas. Un administrador debe conectarlas primero.`}
        </p>
        {canConnect && (
          <div className="mt-6 w-full">
            <ConnectPlatformGrid
              connectingPlatform={connectingPlatform}
              disabled={false}
              onConnect={onConnect}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ZernioScopePanel({ scope, label }: { scope: ZernioScope; label: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const canConnect = scope === "org" ? canConnectOrg(user?.role) : true;

  const accountsQuery = useZernioAccounts(scope);
  const accounts = accountsQuery.data ?? [];
  const hasAccounts = accounts.length > 0;
  const accountsChecking = accountsQuery.isPending;
  const accountsError = accountsQuery.isError ? accountsQuery.error.message : null;

  const postsQuery = useZernioPosts(scope, hasAccounts);

  const toggleAccount = (accountId: string, checked: boolean) => {
    setSelectedAccountIds((prev) =>
      checked ? [...prev, accountId] : prev.filter((id) => id !== accountId),
    );
  };

  const handleConnect = async (platform: string) => {
    setConnectingPlatform(platform);
    const platformLabel =
      ZERNIO_PLATFORMS.find((p) => p.id === platform)?.label ?? platform;

    const safetyTimer = window.setTimeout(() => {
      setConnectingPlatform((current) => {
        if (current === platform) {
          toast.error(
            `No pudimos abrir ${platformLabel}. Revisa tu conexión o ALLOWED_ORIGINS en Supabase.`,
          );
          return null;
        }
        return current;
      });
    }, 19_000);

    try {
      sessionStorage.setItem("zernio_connect_scope", scope);
      const redirectUrl = `${window.location.origin}/app/redes-sociales/callback`;
      const { authUrl } = await getZernioConnectUrl(scope, platform, redirectUrl);
      redirectToZernioOAuth(authUrl);
    } catch (e) {
      toast.error((e as Error).message);
      setConnectingPlatform(null);
    } finally {
      window.clearTimeout(safetyTimer);
    }
  };

  const handleDisconnect = async (account: ZernioAccountRow) => {
    setDisconnectingId(account.zernio_account_id);
    try {
      await disconnectZernioAccount(scope, account.zernio_account_id);
      toast.success("Cuenta desconectada.");
      queryClient.invalidateQueries({ queryKey: zernioAccountsQueryKey(scope) });
      setSelectedAccountIds((prev) => prev.filter((id) => id !== account.zernio_account_id));
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
      queryClient.invalidateQueries({ queryKey: zernioPostsQueryKey(scope) });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Share2 className="h-5 w-5" />
              Cuentas conectadas
            </CardTitle>
            <CardDescription className="mt-1">
              {label} ·{" "}
              {canConnect
                ? "OAuth seguro vía Zernio. Las credenciales no se guardan en Skale."
                : "Solo lectura: un administrador gestiona las conexiones de la automotora."}
            </CardDescription>
          </div>
          {hasAccounts && (
            <Badge variant="secondary" className="shrink-0">
              {accounts.length} conectada{accounts.length === 1 ? "" : "s"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          {accountsChecking && <AccountsCheckingLine />}

          {accountsError && !accountsChecking && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No se pudieron cargar las cuentas</AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p className="text-sm">{accountsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => accountsQuery.refetch()}
                  disabled={accountsQuery.isFetching}
                >
                  {accountsQuery.isFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!accountsChecking && !accountsError && !hasAccounts && (
            <EmptyAccountsState
              scope={scope}
              label={label}
              canConnect={canConnect}
              connectingPlatform={connectingPlatform}
              onConnect={handleConnect}
            />
          )}

          {!accountsChecking && !accountsError && hasAccounts && (
            <>
              <ul className="space-y-2">
                {accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {account.avatar_url ? (
                          <AvatarImage src={account.avatar_url} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs uppercase">
                          {platformInitial(account.platform)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium capitalize">{account.platform}</p>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {account.display_name || account.username || "Cuenta conectada"}
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

              {canConnect && (
                <div className="space-y-2 border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground">Agregar otra red</p>
                  <ConnectPlatformGrid
                    connectingPlatform={connectingPlatform}
                    disabled={false}
                    onConnect={handleConnect}
                    compact
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {hasAccounts ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Megaphone className="h-5 w-5" />
                Nuevo post
              </CardTitle>
              <CardDescription>Publica o programa en las cuentas seleccionadas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cuentas destino</Label>
                <ul className="space-y-2 rounded-lg border p-3">
                  {accounts.map((account) => (
                    <li key={account.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`acc-${scope}-${account.id}`}
                        checked={selectedAccountIds.includes(account.zernio_account_id)}
                        onCheckedChange={(v) =>
                          toggleAccount(account.zernio_account_id, v === true)
                        }
                      />
                      <Label
                        htmlFor={`acc-${scope}-${account.id}`}
                        className="cursor-pointer font-normal capitalize"
                      >
                        {account.platform}
                        {account.username ? ` · @${account.username}` : ""}
                      </Label>
                    </li>
                  ))}
                </ul>
              </div>
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
              {postsQuery.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : !postsQuery.data?.length ? (
                <p className="text-sm text-muted-foreground">Sin publicaciones aún en este ámbito.</p>
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
                      <p className="whitespace-pre-wrap text-sm">{post.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        !accountsChecking &&
        !accountsError && (
          <Card className="border-dashed bg-muted/10">
            <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
              <Megaphone className="h-5 w-5 shrink-0 opacity-60" />
              Conecta al menos una red para crear publicaciones desde Skale.
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
