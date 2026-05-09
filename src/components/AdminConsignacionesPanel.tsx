import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsignacionesAdminRanking, type ConsignacionesAdminRankingRow } from "@/hooks/useConsignacionesAdminRanking";
import { AlertTriangle, ChevronRight, Users } from "lucide-react";

interface AdminConsignacionesPanelProps {
  onSelectUser: (row: ConsignacionesAdminRankingRow) => void;
}

const roleLabels: Record<string, string> = {
  admin: "Admin",
  jefe_jefe: "Jefe principal",
  jefe_sucursal: "Jefe sucursal",
  vendedor: "Vendedor",
  financiero: "Financiero",
  servicio: "Servicio",
  inventario: "Inventario",
};

function initialsOf(name: string | null, email: string | null): string {
  const src = (name?.trim() || email?.trim() || "?").toUpperCase();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).slice(0, 2);
  return src.slice(0, 2);
}

export function AdminConsignacionesPanel({ onSelectUser }: AdminConsignacionesPanelProps) {
  const { data: rows, isLoading, error } = useConsignacionesAdminRanking();

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          Error cargando el ranking. Recargá la página.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Ranking del equipo</CardTitle>
        </div>
        <CardDescription>
          Cantidad de consignaciones por persona. Hacé click en alguien para ver sus vehículos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Todavía no hay consignaciones registradas en tu sucursal.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {rows.map((row) => (
              <li key={row.user_id}>
                <button
                  type="button"
                  onClick={() => onSelectUser(row)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={row.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{initialsOf(row.full_name, row.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        {row.full_name?.trim() || row.email?.trim() || "Sin nombre"}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {roleLabels[row.role] ?? row.role}
                      </Badge>
                    </div>
                    {row.email ? (
                      <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-semibold leading-none">{row.count_total}</span>
                      <span className="text-xs text-muted-foreground">consignacion{row.count_total === 1 ? "" : "es"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">
                        {row.count_publicadas} publ.
                      </span>
                      {row.count_stale > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {row.count_stale} sin publ.
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
