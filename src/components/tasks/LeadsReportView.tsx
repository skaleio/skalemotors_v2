import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildLeadsDailyConsolidated,
  chileTodayKey,
} from "@/lib/services/leadsDailyReport";

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p
        className={`text-2xl font-bold ${
          alert && value > 0 ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function CountTable({ rows }: { rows: { label: string; count: number }[] }) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Sin datos.</p>;
  }
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-border/60 last:border-0">
            <td className="py-1.5">{r.label}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Vista en pantalla del consolidado de leads (el mismo que se descarga en PDF).
// Para que gerencia/Miami revise el reporte del día al instante, sin descargar.
export function LeadsReportView() {
  const { user } = useAuth();
  const isAdminWide = user?.role === "admin" || user?.role === "jefe_jefe";
  const branchId = isAdminWide ? null : user?.branch_id ?? null;
  const [date, setDate] = useState(chileTodayKey());

  const { data, isLoading, error } = useQuery({
    queryKey: ["leads-consolidated", date, branchId],
    queryFn: () => buildLeadsDailyConsolidated({ date, branchId }),
    enabled: !!user?.tenant_id,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Reporte de Leads
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {isAdminWide ? "Todas las sucursales" : "Tu sucursal"} · foto del pipeline + métricas del día.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="leads-report-date" className="text-xs">
              Fecha
            </Label>
            <Input
              id="leads-report-date"
              type="date"
              className="h-9 w-40"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-sm text-muted-foreground">Cargando reporte…</p>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">No se pudo cargar el reporte de leads.</p>
        ) : !data ? null : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Resumen del día</h3>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Nuevos hoy" value={data.resumen.nuevosHoy} />
                <Stat label="Activos en pipeline" value={data.resumen.activos} />
                <Stat label="Cerrados hoy" value={data.resumen.cerradosHoy} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Alertas de gestión</h3>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Prioridad sin contactar" value={data.alertas.prioridadSinContactar} alert />
                <Stat label="Sin asignar" value={data.alertas.sinAsignar} alert />
                <Stat label="Seguimientos vencidos" value={data.alertas.seguimientosVencidos} alert />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold mb-2">Activos por etapa</h3>
                <CountTable rows={data.porEtapa} />
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Activos por fuente</h3>
                <CountTable rows={data.porFuente} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
