import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  acceptPrivacyPolicy,
  exportTenantDataBundle,
  getCurrentPrivacyPolicy,
  getTenantAiBudget,
  hasAcceptedCurrentPolicy,
} from "@/lib/services/privacy";

export function PrivacyComplianceSection() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const policyQuery = useQuery({
    queryKey: ["privacy", "policy"],
    queryFn: getCurrentPrivacyPolicy,
  });

  const acceptedQuery = useQuery({
    queryKey: ["privacy", "accepted", policyQuery.data?.id],
    queryFn: () => hasAcceptedCurrentPolicy(policyQuery.data!.id),
    enabled: Boolean(policyQuery.data?.id),
  });

  const budgetQuery = useQuery({
    queryKey: ["ai", "budget", user?.tenant_id],
    queryFn: getTenantAiBudget,
    enabled: Boolean(user?.tenant_id) && ["admin", "gerente", "financiero", "jefe_jefe"].includes(user?.role ?? ""),
  });

  async function onAccept() {
    if (!policyQuery.data) return;
    try {
      await acceptPrivacyPolicy(policyQuery.data.id, user?.tenant_id ?? null);
      toast.success("Política de privacidad aceptada.");
      await qc.invalidateQueries({ queryKey: ["privacy"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar aceptación");
    }
  }

  async function onExport() {
    try {
      const bundle = await exportTenantDataBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skale-export-${user?.tenant_id ?? "tenant"}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportación descargada (portabilidad Ley 19.628).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar datos");
    }
  }

  const policy = policyQuery.data;
  const accepted = acceptedQuery.data === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Privacidad y datos personales (Ley 19.628)
        </CardTitle>
        <CardDescription>
          Consentimiento, portabilidad y control de costos de IA por automotora.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {policyQuery.isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando política…
          </p>
        )}
        {policy && (
          <div className="rounded border p-3 space-y-2">
            <p className="font-medium">{policy.title}</p>
            <p className="text-sm text-muted-foreground">Versión {policy.version}</p>
            {policy.body_url && (
              <a
                href={policy.body_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
              >
                Leer política completa
              </a>
            )}
            {!accepted && (
              <Button size="sm" onClick={onAccept}>
                Acepto el tratamiento de datos
              </Button>
            )}
            {accepted && (
              <p className="text-sm text-green-600 dark:text-green-400">Aceptación registrada.</p>
            )}
          </div>
        )}

        {budgetQuery.data && (
          <div className="rounded border p-3 text-sm">
            <p className="font-medium">Presupuesto IA del mes</p>
            <p className="text-muted-foreground mt-1">
              Usado: ${Number(budgetQuery.data.spent_usd ?? 0).toFixed(2)} USD / Tope: $
              {Number(budgetQuery.data.budget_usd ?? 0).toFixed(2)} USD
            </p>
          </div>
        )}

        {["admin", "gerente", "jefe_jefe"].includes(user?.role ?? "") && (
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar bundle del tenant (portabilidad)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
