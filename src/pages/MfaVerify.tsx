import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { StaticLoginBackground } from "@/components/StaticLoginBackground";
import { challengeAndVerify, listFactors } from "@/lib/services/mfa";
import { useAuth } from "@/contexts/AuthContext";

export default function MfaVerify() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const factorsQuery = useQuery({
    queryKey: ["mfa", "factors"],
    queryFn: listFactors,
  });

  const factor = (factorsQuery.data ?? []).find((f) => f.status === "verified");

  const from =
    (location.state as { from?: string } | null)?.from ??
    (user?.role === "vendedor"
      ? "/app/crm"
      : user?.role === "fotografo"
        ? "/app/consignaciones"
        : "/app");

  async function submit() {
    if (!factor) {
      toast.error("No hay un dispositivo MFA activo. Configuralo en Ajustes.");
      return;
    }
    if (code.replace(/\s/g, "").length !== 6) {
      toast.error("Ingresá el código de 6 dígitos.");
      return;
    }
    setBusy(true);
    try {
      await challengeAndVerify(factor.id, code);
      await qc.invalidateQueries({ queryKey: ["mfa"] });
      toast.success("Verificación correcta.");
      navigate(from, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código incorrecto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <StaticLoginBackground />
      <Card className="relative z-10 w-full max-w-md border-border/60 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Verificación en dos pasos
          </CardTitle>
          <CardDescription>
            Ingresá el código de tu app de autenticación para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {factorsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          )}
          {!factorsQuery.isLoading && !factor && (
            <p className="text-sm text-destructive">
              Tu cuenta no tiene MFA activo. Activá MFA en Ajustes → Seguridad.
            </p>
          )}
          {factor && (
            <>
              <div>
                <Label htmlFor="mfa-login-code">Código de 6 dígitos</Label>
                <Input
                  id="mfa-login-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  disabled={busy}
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={submit} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verificar
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
