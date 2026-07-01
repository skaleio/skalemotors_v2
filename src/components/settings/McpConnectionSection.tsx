import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Copy, Loader2, Plug, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  rpcListLeadIngestKeysTenant,
  rpcMintLeadIngestKeyTenant,
  rpcRevokeLeadIngestKey,
} from "@/lib/supabaseLeadIngestRpc";
import { toast } from "sonner";

/** Roles que pueden emitir la clave de tenant (cubre todas las sucursales). */
const ROLES_CAN_MANAGE_MCP = new Set(["admin", "jefe_jefe"]);

type BranchOption = { id: string; name: string };

type TenantKeyMeta = {
  id: string;
  label: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

function buildConnectorUrl(apiKey: string, branchId: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://skalemotors-v2.vercel.app";
  const params = new URLSearchParams({ k: apiKey, b: branchId });
  return `${origin}/api/mcp?${params.toString()}`;
}

/**
 * Prepara la conexión MCP para Claude: emite una clave de TENANT (una por concesionario)
 * y muestra la URL del conector lista para pegar en Claude → Conectores. La sucursal
 * elegida queda fija como destino por defecto de los leads cargados desde Claude.
 */
export function McpConnectionSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canManage = user ? ROLES_CAN_MANAGE_MCP.has(user.role) : false;

  const [branchId, setBranchId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const { data: branchRows = [] } = useQuery<BranchOption[]>({
    queryKey: ["mcp-branches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as BranchOption[];
    },
    enabled: !!user && canManage,
  });

  const effectiveBranchId = useMemo(() => {
    if (branchId) return branchId;
    if (user?.branch_id && branchRows.some((b) => b.id === user.branch_id)) {
      return user.branch_id;
    }
    return branchRows[0]?.id ?? "";
  }, [branchId, user?.branch_id, branchRows]);

  const { data: tenantKeys = [], isLoading: keysLoading } = useQuery<TenantKeyMeta[]>({
    queryKey: ["mcp-tenant-keys", user?.tenant_id],
    queryFn: async () => {
      const { data, error } = await rpcListLeadIngestKeysTenant();
      if (error) throw error;
      return Array.isArray(data) ? (data as TenantKeyMeta[]) : [];
    },
    enabled: !!user && canManage,
  });

  const activeKey = tenantKeys.find((k) => !k.revoked_at) ?? null;

  const refreshKeys = () =>
    queryClient.invalidateQueries({ queryKey: ["mcp-tenant-keys", user?.tenant_id] });

  const doMint = async () => {
    if (!effectiveBranchId) {
      toast.error("Elegí la sucursal por defecto antes de generar la conexión.");
      return;
    }
    setMinting(true);
    try {
      // Una sola clave de tenant: revoca la anterior antes de emitir una nueva.
      for (const k of tenantKeys.filter((x) => !x.revoked_at)) {
        await rpcRevokeLeadIngestKey(k.id);
      }
      const { data, error } = await rpcMintLeadIngestKeyTenant("MCP Claude");
      if (error) throw error;
      const row = data as { api_key?: string } | null;
      if (!row?.api_key) throw new Error("No se recibió la clave");
      setRevealedUrl(buildConnectorUrl(row.api_key, effectiveBranchId));
      setCopied(false);
      setDialogOpen(true);
      refreshKeys();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMinting(false);
      setConfirmRegen(false);
    }
  };

  const onGenerateClick = () => {
    if (activeKey) setConfirmRegen(true);
    else void doMint();
  };

  const copyUrl = async () => {
    if (!revealedUrl) return;
    try {
      await navigator.clipboard.writeText(revealedUrl);
      setCopied(true);
      toast.success("URL copiada al portapapeles.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto manualmente.");
    }
  };

  if (!user || !canManage) return null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-600" />
          Conectar con Claude (MCP)
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed max-w-2xl">
          Genera una conexión para cargar leads y agendar citas hablándole a Claude. Te damos una
          URL que pegás una sola vez en Claude → Conectores, y desde ahí le decís cosas como
          <em> “cargá este lead: Juan Pérez, +56 9 1234 5678, busca un SUV”</em>. La clave es{" "}
          <strong>una por concesionario</strong> y los leads caen en la sucursal que elijas abajo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 max-w-sm">
          <Label htmlFor="mcp-branch">Sucursal por defecto</Label>
          <Select value={effectiveBranchId || undefined} onValueChange={setBranchId}>
            <SelectTrigger id="mcp-branch">
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
          <p className="text-xs text-muted-foreground">
            Dónde caen los leads cargados desde Claude. Para cambiarla, regenerá la conexión.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onGenerateClick} disabled={minting || !effectiveBranchId}>
            {minting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plug className="h-4 w-4 mr-2" />}
            {activeKey ? "Regenerar conexión" : "Generar conexión"}
          </Button>
          {activeKey ? (
            <span className="text-xs text-muted-foreground">
              Conexión activa desde {new Date(activeKey.created_at).toLocaleDateString("es-CL")}
              {activeKey.last_used_at
                ? ` · último uso ${new Date(activeKey.last_used_at).toLocaleDateString("es-CL")}`
                : " · sin usar todavía"}
            </span>
          ) : null}
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-medium text-muted-foreground">
            Estado
          </div>
          {keysLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : !activeKey ? (
            <p className="p-4 text-sm text-muted-foreground">
              Sin conexión activa. Elegí la sucursal y pulsá <strong>Generar conexión</strong>.
            </p>
          ) : (
            <div className="flex items-center justify-between p-4">
              <div className="text-sm">
                <div className="font-medium">Conexión MCP lista</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  La URL con la clave solo se muestra al generarla. Si la perdiste, regenerá.
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                Activa
              </Badge>
            </div>
          )}
        </div>
      </CardContent>

      {/* Confirmar regeneración (revoca la conexión anterior) */}
      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar la conexión?</AlertDialogTitle>
            <AlertDialogDescription>
              Se revoca la conexión actual: cualquier Claude que la use dejará de funcionar hasta
              pegar la nueva URL. Útil si perdiste la URL o querés cambiar la sucursal por defecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doMint()}>Regenerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* URL del conector (se muestra una sola vez) + pasos */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setRevealedUrl(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tu conexión MCP</DialogTitle>
            <DialogDescription>
              Copiá esta URL ahora: no se vuelve a mostrar. Contiene tu clave.
            </DialogDescription>
          </DialogHeader>
          {revealedUrl ? (
            <div className="space-y-4 py-1">
              <div
                className="rounded-xl border-2 border-primary/25 bg-muted/60 p-4 shadow-inner"
                role="region"
                aria-label="URL del conector MCP"
              >
                <code className="block font-mono text-xs leading-relaxed break-all text-foreground select-all">
                  {revealedUrl}
                </code>
              </div>
              <Button type="button" size="lg" className="w-full gap-2" onClick={() => void copyUrl()}>
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {copied ? "Copiado" : "Copiar URL"}
              </Button>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
                <div className="font-medium">Pegarla en Claude:</div>
                <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                  <li>Abrí Claude → <strong>Ajustes</strong> → <strong>Conectores</strong>.</li>
                  <li>
                    <strong>Agregar conector personalizado</strong> y pegá la URL de arriba.
                  </li>
                  <li>Confirmá. Aparecen las herramientas <em>crear_lead</em> y <em>agendar_cita</em>.</li>
                  <li>Probá: <em>“cargá un lead: Ana Soto, +56 9 8765 4321, busca camioneta”</em>.</li>
                </ol>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
