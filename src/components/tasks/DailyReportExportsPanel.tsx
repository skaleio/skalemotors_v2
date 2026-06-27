import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2, Package } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  fetchAppointmentsExportRows,
  fetchConsignacionesExportRows,
  fetchContactCoverageExportRows,
  fetchDailyReportExportRows,
  fetchLeadCallsExportRows,
  fetchReportSellers,
} from "@/lib/services/informeDiarioReports";
import { chileTodayIsoDate } from "@/lib/types/dailySalesReport";
import { exportRowsToXlsx, exportSheetsToXlsx, type ExportRow } from "@/lib/utils/exportXlsx";

const ALL_SELLERS = "all";

interface ReportCard {
  key: string;
  title: string;
  description: string;
  sheet: string;
  fileBase: string;
  usesRange: boolean;
  fetcher: (
    tenantId: string,
    from: string,
    to: string,
    sellerId?: string | null,
  ) => Promise<ExportRow[]>;
}

const REPORTS: ReportCard[] = [
  {
    key: "informe",
    title: "Informe diario",
    description: "Llamados, créditos, RRSS y plataformas por vendedor y día.",
    sheet: "Informe diario",
    fileBase: "informe-diario",
    usesRange: true,
    fetcher: fetchDailyReportExportRows,
  },
  {
    key: "consignaciones",
    title: "Consignaciones",
    description: "Dueño, vehículo, precios y estado de cada consignación.",
    sheet: "Consignaciones",
    fileBase: "consignaciones",
    usesRange: true,
    fetcher: fetchConsignacionesExportRows,
  },
  {
    key: "llamados",
    title: "Llamados de leads",
    description: "Registro de llamadas (notas canal llamada) con su resultado.",
    sheet: "Llamados leads",
    fileBase: "llamados-leads",
    usesRange: true,
    fetcher: fetchLeadCallsExportRows,
  },
  {
    key: "citas",
    title: "Citas",
    description: "Citas agendadas: cliente, vendedor, tipo, estado y fecha.",
    sheet: "Citas",
    fileBase: "citas",
    usesRange: true,
    fetcher: fetchAppointmentsExportRows,
  },
  {
    key: "cobertura",
    title: "Cobertura de contacto",
    description: "Cuántos leads contactó cada vendedor del total que tiene (foto actual).",
    sheet: "Cobertura contacto",
    fileBase: "cobertura-contacto",
    usesRange: false,
    fetcher: (t, _from, _to, sellerId) => fetchContactCoverageExportRows(t, sellerId),
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
  const [seller, setSeller] = useState<string>(ALL_SELLERS);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const sellersQuery = useQuery({
    queryKey: ["report-sellers", user?.tenant_id],
    queryFn: () => fetchReportSellers(user!.tenant_id!),
    enabled: !!user?.tenant_id,
    staleTime: 5 * 60 * 1000,
  });

  const sellerId = seller === ALL_SELLERS ? null : seller;
  const sellerSuffix = seller === ALL_SELLERS ? "" : "_vendedor";

  const validateRange = (): boolean => {
    if (from > to) {
      toast({
        title: "Rango inválido",
        description: "La fecha 'desde' no puede ser mayor que 'hasta'.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleDownload = async (report: ReportCard) => {
    if (!user?.tenant_id) {
      toast({ title: "Sesión inválida", variant: "destructive" });
      return;
    }
    if (report.usesRange && !validateRange()) return;

    setLoadingKey(report.key);
    try {
      const rows = await report.fetcher(user.tenant_id, from, to, sellerId);
      if (rows.length === 0) {
        toast({ title: "Sin datos", description: "No hay registros para descargar." });
        return;
      }
      const period = report.usesRange ? `${from}_a_${to}` : today;
      exportRowsToXlsx(rows, report.sheet, `${report.fileBase}${sellerSuffix}_${period}.xlsx`);
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

  const handleDownloadAll = async () => {
    if (!user?.tenant_id) {
      toast({ title: "Sesión inválida", variant: "destructive" });
      return;
    }
    if (!validateRange()) return;

    setLoadingKey("__all__");
    try {
      const results = await Promise.all(
        REPORTS.map((r) => r.fetcher(user.tenant_id!, from, to, sellerId)),
      );
      const sheets = REPORTS.map((r, i) => ({ name: r.sheet, rows: results[i] }));
      if (sheets.every((s) => s.rows.length === 0)) {
        toast({ title: "Sin datos", description: "No hay registros para descargar." });
        return;
      }
      exportSheetsToXlsx(sheets, `reportes${sellerSuffix}_${from}_a_${to}.xlsx`);
    } catch (err) {
      console.error("[DailyReportExportsPanel] export combinado falló", err);
      toast({
        title: "No se pudo descargar",
        description: err instanceof Error ? err.message : "Intentá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoadingKey(null);
    }
  };

  const busy = loadingKey !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Reportes
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Descargá los reportes en Excel. El rango aplica a Informe diario, Consignaciones,
          Llamados y Citas; Cobertura de contacto es una foto del estado actual.
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
          <div className="space-y-1">
            <Label className="text-xs">Vendedor</Label>
            <Select value={seller} onValueChange={setSeller}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SELLERS}>Todos (global)</SelectItem>
                {(sellersQuery.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="h-9 ml-auto" onClick={handleDownloadAll} disabled={busy}>
            {loadingKey === "__all__" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            Descargar todo (1 Excel)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                disabled={busy}
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
