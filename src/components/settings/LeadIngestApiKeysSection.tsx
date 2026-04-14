import { useMemo, useState } from "react";
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
import { Check, Key, Loader2, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  rpcListLeadIngestKeys,
  rpcMintLeadIngestKey,
  rpcRevokeLeadIngestKey,
} from "@/lib/supabaseLeadIngestRpc";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type BranchOption = { id: string; name: string };

type LeadIngestKeyMeta = {
  id: string;
  label: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

type LeadIngestApiKeysSectionProps = {
  /** Si es true, muestra un enlace a la página Integraciones (útil en Configuración). */
  showLinkToIntegrationsPage?: boolean;
};

/**
 * Generador de API keys para el header `x-api-key` (ingesta n8n → /api/n8n-lead-ingest).
 * La sucursal se resuelve en servidor según la clave; no hace falta enviar `branch_id` en el POST si siempre usas la misma clave para esa sucursal.
 */
export function LeadIngestApiKeysSection({
  showLinkToIntegrationsPage = false,
}: LeadIngestApiKeysSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [n8nLabel, setN8nLabel] = useState("");
  /** Un solo modal: formulario → éxito con clave copiable. */
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [mintDialogPhase, setMintDialogPhase] = useState<"form" | "success">("form");
  const [n8nRevealedKey, setN8nRevealedKey] = useState<string | null>(null);
  const [n8nMinting, setN8nMinting] = useState(false);
  const [n8nCopied, setN8nCopied] = useState(false);
  const [n8nRevokeId, setN8nRevokeId] = useState<string | null>(null);

  const resetMintDialog = () => {
    setMintDialogPhase("form");
    setN8nRevealedKey(null);
    setN8nCopied(false);
    setN8nLabel("");
  };

  const onMintDialogOpenChange = (open: boolean) => {
    setMintDialogOpen(open);
    if (!open) resetMintDialog();
  };

  const copyRevealedKey = async () => {
    if (!n8nRevealedKey) return;
    try {
      await navigator.clipboard.writeText(n8nRevealedKey);
      setN8nCopied(true);
      toast.success("Clave copiada al portapapeles.");
      window.setTimeout(() => setN8nCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto manualmente.");
    }
  };

  const { data: branchRows = [] } = useQuery<BranchOption[]>({
    queryKey: ["integrations-branches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as BranchOption[];
    },
    enabled: !!user,
  });

  const effectiveBranchId = useMemo(() => {
    if (!user || branchRows.length === 0) return "";
    if (user.branch_id && branchRows.some((b) => b.id === user.branch_id)) {
      return user.branch_id;
    }
    return branchRows[0]?.id ?? "";
  }, [user, branchRows]);

  const { data: n8nKeys = [], isLoading: n8nKeysLoading } = useQuery<LeadIngestKeyMeta[]>({
    queryKey: ["lead-ingest-keys", effectiveBranchId],
    queryFn: async () => {
      const { data, error } = await rpcListLeadIngestKeys(effectiveBranchId);
      if (error) throw error;
      if (!Array.isArray(data)) return [];
      return data as LeadIngestKeyMeta[];
    },
    enabled: !!effectiveBranchId,
  });

  /** Solo activas; la RPC ya excluye revocadas tras migrar, esto cubre respuestas antiguas. */
  const activeKeys = useMemo(
    () => n8nKeys.filter((k) => !k.revoked_at),
    [n8nKeys],
  );

  const handleMintN8nKey = async () => {
    if (!effectiveBranchId) {
      toast.error("No hay sucursal asignada para crear la clave.");
      return;
    }
    setN8nMinting(true);
    try {
      const { data, error } = await rpcMintLeadIngestKey({
        p_branch_id: effectiveBranchId,
        p_label: n8nLabel.trim(),
      });
      if (error) throw error;
      const row = data as { api_key?: string } | null;
      if (!row?.api_key) throw new Error("No se recibió la clave");
      setN8nRevealedKey(row.api_key);
      setMintDialogPhase("success");
      setN8nCopied(false);
      queryClient.invalidateQueries({ queryKey: ["lead-ingest-keys", effectiveBranchId] });
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("lead_ingest_keys") && msg.includes("does not exist")) {
        toast.error(
          "Falta la tabla lead_ingest_keys en Supabase. Ejecuta supabase db push o aplica la migración 20260413120000_lead_ingest_keys_table.sql / lead_ingest_keys_table_and_rpcs.",
          { duration: 10000 },
        );
      } else if (msg.includes("gen_random_bytes") || msg.includes("pgcrypto")) {
        toast.error(
          "En Supabase falta la extensión pgcrypto o el search_path de la función. En Dashboard → Database → Extensions activa «pgcrypto», luego ejecuta supabase db push o pega scripts/sql/fix_lead_ingest_pgcrypto.sql en SQL Editor.",
          { duration: 12000 },
        );
      } else if (msg.includes("mint_lead_ingest_key") || msg.includes("schema cache")) {
        toast.error(
          "Falta la función en Supabase. Aplica migraciones (supabase db push) o ejecuta scripts/sql/fix_lead_ingest_pgcrypto.sql en SQL Editor.",
          { duration: 8000 },
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setN8nMinting(false);
    }
  };

  const handleRevokeN8nKey = async () => {
    if (!n8nRevokeId || !effectiveBranchId) return;
    try {
      const { data, error } = await rpcRevokeLeadIngestKey(n8nRevokeId);
      if (error) throw error;
      const r = data as { ok?: boolean; error?: string };
      if (r?.ok === false) toast.error("No se encontró la clave.");
      else toast.success("Clave revocada.");
      setN8nRevokeId(null);
      queryClient.invalidateQueries({ queryKey: ["lead-ingest-keys", effectiveBranchId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Key className="h-5 w-5 text-amber-600" />
          API n8n — ingesta de leads
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed max-w-2xl">
          Genera el secreto para la cabecera <code className="text-xs rounded bg-muted px-1 py-0.5">x-api-key</code>.
          Solo se muestra completo una vez. Pégalo en n8n y listo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!user ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : branchRows.length === 0 || !effectiveBranchId ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-900 dark:text-amber-100">
            Necesitas una sucursal en el sistema para emitir claves. Configúrala en{" "}
            <Link to="/app/settings" className="underline font-medium">
              Configuración
            </Link>
            .
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Dialog open={mintDialogOpen} onOpenChange={onMintDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button type="button" size="default">
                    <Key className="h-4 w-4 mr-2" />
                    Generar clave
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  {mintDialogPhase === "form" ? (
                    <>
                      <DialogHeader>
                        <DialogTitle>Nueva clave</DialogTitle>
                        <DialogDescription>
                          Etiqueta opcional para reconocerla en la lista (p. ej. n8n).
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-2 py-2">
                        <Label htmlFor="n8n-key-label-settings">Etiqueta</Label>
                        <Input
                          id="n8n-key-label-settings"
                          value={n8nLabel}
                          onChange={(e) => setN8nLabel(e.target.value)}
                          placeholder="n8n"
                          autoComplete="off"
                        />
                      </div>
                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onMintDialogOpenChange(false)}
                        >
                          Cancelar
                        </Button>
                        <Button type="button" onClick={() => void handleMintN8nKey()} disabled={n8nMinting}>
                          {n8nMinting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Crear
                        </Button>
                      </DialogFooter>
                    </>
                  ) : (
                    <>
                      <DialogHeader>
                        <DialogTitle>Tu clave API</DialogTitle>
                      </DialogHeader>
                      {n8nRevealedKey ? (
                        <div className="space-y-4 py-2">
                          <div
                            className="rounded-xl border-2 border-primary/25 bg-muted/60 p-4 shadow-inner"
                            role="region"
                            aria-label="Clave API"
                          >
                            <code className="block font-mono text-xs sm:text-sm leading-relaxed break-all text-foreground select-all">
                              {n8nRevealedKey}
                            </code>
                          </div>
                          <Button
                            type="button"
                            size="lg"
                            className="w-full gap-2"
                            onClick={() => void copyRevealedKey()}
                          >
                            {n8nCopied ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <Copy className="h-5 w-5" />
                            )}
                            {n8nCopied ? "Copiado" : "Copiar al portapapeles"}
                          </Button>
                        </div>
                      ) : null}
                      <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => onMintDialogOpenChange(false)}>
                          Cerrar
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>

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
                    Los flujos que la usen dejarán de funcionar hasta que configures una nueva.
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

            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-2.5 text-sm font-medium text-muted-foreground">
                Claves
              </div>
              {n8nKeysLoading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : activeKeys.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Aún no hay claves activas. Pulsa <strong>Generar clave</strong> para crear una.
                </p>
              ) : (
                <ul className="divide-y">
                  {activeKeys.map((k) => (
                    <li
                      key={k.id}
                      className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-medium text-sm">{k.label || "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Creada: {new Date(k.created_at).toLocaleString("es-CL")}
                          {k.last_used_at
                            ? ` · último uso: ${new Date(k.last_used_at).toLocaleString("es-CL")}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                          Activa
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setN8nRevokeId(k.id)}
                        >
                          Revocar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {showLinkToIntegrationsPage ? (
              <p className="text-xs text-muted-foreground">
                Otras conexiones en{" "}
                <Link to="/app/integrations" className="underline font-medium text-foreground">
                  Integraciones
                </Link>
                .
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
