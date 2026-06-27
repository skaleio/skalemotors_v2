import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  fetchConsignacionesExportRows,
  fetchContactCoverageExportRows,
  fetchDailyReportExportRows,
  fetchLeadCallsExportRows,
} from "@/lib/services/informeDiarioReports";
import { chileTodayIsoDate } from "@/lib/types/dailySalesReport";
import { exportRowsToXlsx, type ExportRow } from "@/lib/utils/exportXlsx";

interface ReportCard {
  key: string;
  title: string;
  description: string;
  sheet: string;
  fileBase: string;
  usesRange: boolean;
  fetcher: (tenantId: string, from: string, to: string) => Promise<ExportRow[]>;
}

const REPORTS: ReportCard[] = [
  {
    key: "informe",
    title: "Informe diario",
    description: "Llamados, créditos, RRSS y plataformas por vendedor y día.",
    sheet: "Informe diario",
    fileBase: "informe-diario",
    usesRange: true,
    fetcher: (t, f, to) => fetchDailyReportExportRows(t, f, to),
  },
  {
    key: "consignaciones",
    title: "Consignaciones",
    description: "Dueño, vehículo, precios y estado de cada consignación.",
    sheet: "Consignaciones",
    fileBase: "consignaciones",
    usesRange: true,
    fetcher: (t, f, to) => fetchConsignacionesExportRows(t, f, to),
  },
  {
    key: "llamados",
    title: "Llamados de leads",
    description: "Registro de llamadas (notas canal llamada) con su resultado.",
    sheet: "Llamados leads",
    fileBase: "llamados-leads",
    usesRange: true,
    fetcher: (t, f, to) => fetchLeadCallsExportRows(t, f, to),
  },
  {
    key: "cobertura",
    title: "Cobertura de contacto",
    description: "Cuántos leads contactó cada vendedor del total que tiene (foto actual).",
    sheet: "Cobertura contacto",
    fileBase: "cobertura-contacto",
    usesRange: false,
    fetcher: (t) => fetchContactCoverageExportRows(t),
  },
];

function firstOfMonth(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function DailyReportExportsPanel() {
  const { user } = useAuth();
  const today = chileTodayIsoDate();
  const [from, setFrom] = useState(firstOfMonth(today));
  const [to, setTo] = useState(today);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const handleDownload = async (report: ReportCard) => {
    if (!user?.tenant_id) {
      toast({ title: "Sesión inválida", variant: "destructive" });
      return;
    }
    if (report.usesRange && from > to) {
      toast({
        title: "Rango inválido",
        description: "La fecha 'desde' no puede ser mayor que 'hasta'.",
        variant: "destructive",
      });
      return;
    }

    setLoadingKey(report.key);
    try {
      const rows = await report.fetcher(user.tenant_id, from, to);
      if (rows.length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay registros para descargar en ese período.",
        });
        return;
      }
      const suffix = report.usesRange ? `${from}_a_${to}` : today;
      exportRowsToXlsx(rows, report.sheet, `${report.fileBase}_${suffix}.xlsx`);
    } catch (err) {
      console.error("[DailyReportExportsPanel] export falló", { report: report.key, err });
      toast({
        title: "No se pudo descargar",
        description: err instanceof Error ? err.message : "Intentá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Reportes
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Descargá los reportes en Excel. El rango aplica a Informe diario, Consignaciones y
          Llamados; Cobertura de contacto es una foto del estado actual.
        </p>
        <div className="flex flex-wrap items-end gap-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="report-from" className="text-xs">
              Desde
            </Label>
            <Input
              id="report-from"
              type="date"
              className="h-9 w-40"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to" className="text-xs">
              Hasta
            </Label>
            <Input
              id="report-to"
              type="date"
              className="h-9 w-40"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORTS.map((report) => (
            <div
              key={report.key}
              className="flex flex-col justify-between gap-3 rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">{report.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleDownload(report)}
                disabled={loadingKey === report.key}
              >
                {loadingKey === report.key ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Descargar Excel
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
