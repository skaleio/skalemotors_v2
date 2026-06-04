import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hoursSince, type SellerEngagementRow } from "@/lib/sellerEngagement";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

type SellerInactivityPanelProps = {
  rows: SellerEngagementRow[];
  inactivityHours?: number;
  isLoading?: boolean;
};

export function SellerInactivityPanel({
  rows,
  inactivityHours = 24,
  isLoading,
}: SellerInactivityPanelProps) {
  const inactive = rows.filter((r) => r.is_inactive);

  if (isLoading) {
    return (
      <Card className="border-amber-200/60 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20">
        <CardContent className="py-4 text-sm text-muted-foreground">Cargando alertas…</CardContent>
      </Card>
    );
  }

  if (inactive.length === 0) {
    return (
      <Card className="border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Equipo al día
          </CardTitle>
          <CardDescription>
            Ningún vendedor lleva más de {inactivityHours} h sin actividad con leads asignados abiertos.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-rose-200/70 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/25">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-rose-800 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Vendedores sin actividad ({inactive.length})
        </CardTitle>
        <CardDescription>
          Tienen leads abiertos sin movimiento ni notas/actividad en la plataforma por más de{" "}
          {inactivityHours} horas. Revisa en{" "}
          <Link to="/app/crm" className="font-medium text-primary underline-offset-2 hover:underline">
            CRM
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {inactive.map((r) => {
            const h = hoursSince(r.last_engagement_at);
            return (
              <li
                key={r.seller_key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rose-200/60 bg-background/80 px-3 py-2 text-sm dark:border-rose-900/50"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.seller_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.stale_assigned_leads} lead(s) sin mover ·{" "}
                    {h == null ? "sin registro de actividad" : `última actividad hace ${h} h`}
                  </p>
                </div>
                <Badge variant="destructive" className="shrink-0">
                  Inactivo
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
