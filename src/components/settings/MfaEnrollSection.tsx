import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  listFactors,
  enrollTotp,
  verifyEnroll,
  unenroll,
  type EnrollResult,
} from "@/lib/services/mfa";

export function MfaEnrollSection() {
  const qc = useQueryClient();
  const { confirm: askConfirm, ConfirmDialog } = useConfirmDialog();
  const [friendlyName, setFriendlyName] = useState("");
  const [pending, setPending] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const factorsQuery = useQuery({
    queryKey: ["mfa", "factors"],
    queryFn: listFactors,
  });

  const verified = (factorsQuery.data ?? []).filter((f) => f.status === "verified");
  const hasVerified = verified.length > 0;

  async function startEnroll() {
    if (!friendlyName.trim()) {
      toast.error("Ponele un nombre al dispositivo (ej: 'iPhone Antonio').");
      return;
    }
    setBusy(true);
    try {
      const r = await enrollTotp(friendlyName.trim());
      setPending(r);
      toast.success("Escaneá el QR con tu app de autenticación.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error iniciando MFA");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!pending) return;
    if (code.replace(/\s/g, "").length !== 6) {
      toast.error("Ingresá el código de 6 dígitos.");
      return;
    }
    setBusy(true);
    try {
      await verifyEnroll(pending.factorId, code);
      toast.success("MFA activado correctamente.");
      setPending(null);
      setCode("");
      setFriendlyName("");
      await qc.invalidateQueries({ queryKey: ["mfa", "factors"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código incorrecto");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factorId: string) {
    const ok = await askConfirm({
      title: "¿Eliminar este dispositivo MFA?",
      description: "Vas a poder loguearte solo con password hasta enrollar uno nuevo.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await unenroll(factorId);
      toast.success("Dispositivo MFA eliminado.");
      await qc.invalidateQueries({ queryKey: ["mfa", "factors"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error eliminando MFA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {ConfirmDialog}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Autenticación en dos pasos (MFA)
        </CardTitle>
        <CardDescription>
          Sumá un segundo factor con Google Authenticator, 1Password o cualquier app TOTP. Recomendado para roles admin / gerente / jefe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {factorsQuery.isLoading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando factores...
          </div>
        )}

        {hasVerified && (
          <div className="space-y-2">
            <Label>Dispositivos activos</Label>
            {verified.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div className="font-medium">{f.friendly_name ?? "Sin nombre"}</div>
                  <Badge variant="secondary" className="mt-1">Verificado</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFactor(f.id)}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {!pending && (
          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="mfa-name">Nombre del dispositivo</Label>
              <Input
                id="mfa-name"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                placeholder="Ej: iPhone personal"
                disabled={busy}
              />
            </div>
            <Button onClick={startEnroll} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {hasVerified ? "Agregar otro dispositivo" : "Activar MFA"}
            </Button>
          </div>
        )}

        {pending && (
          <div className="space-y-3 rounded border bg-muted/30 p-4">
            <div>
              <Label>1) Escaneá este QR</Label>
              <div
                className="mt-2 inline-block rounded bg-white p-2"
                dangerouslySetInnerHTML={{ __html: pending.qr }}
              />
            </div>
            <div>
              <Label>O ingresá manualmente este código</Label>
              <code className="block mt-1 rounded bg-background p-2 font-mono text-sm break-all">
                {pending.secret}
              </code>
            </div>
            <div>
              <Label htmlFor="mfa-code">2) Código de 6 dígitos de la app</Label>
              <Input
                id="mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                disabled={busy}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmEnroll} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verificar y activar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPending(null);
                  setCode("");
                }}
                disabled={busy}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
