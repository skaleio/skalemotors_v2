import { Download, FileText, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserReportMetrics } from "@/hooks/useDailySalesReports";
import {
  downloadUserHistoryPdf,
  downloadVendedorReportPdf,
} from "@/lib/pdf/dailyReportPdf";
import {
  fetchDailyReportById,
  fetchLeadsCallsForUserDay,
  fetchUserReportPdfDataRange,
} from "@/lib/services/dailySalesReports";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string;
  branchName: string | null;
  reportDate: string;
  reportId: string | null;
}

const SERIES = [
  { key: "calls", label: "Llamados", color: "#2563eb" },
  { key: "credits", label: "Créditos", color: "#16a34a" },
  { key: "social", label: "Publicaciones", color: "#f59e0b" },
  { key: "consignments", label: "Consignaciones", color: "#db2777" },
] as const;

export function DailyReportVendedorAnalysis({
  open,
  onOpenChange,
  userId,
  fullName,
  branchName,
  reportDate,
  reportId,
}: Props) {
  const metrics = useUserReportMetrics(userId, 30, open);
  const [downloadingDay, setDownloadingDay] = useState(false);
  const [downloadingHistory, setDownloadingHistory] = useState(false);

  const chartData = useMemo(
    () =>
      (metrics.data ?? []).map((m) => ({
        ...m,
        label: m.date.slice(8, 10) + "/" + m.date.slice(5, 7),
      })),
    [metrics.data],
  );

  const totals = useMemo(() => {
    return (metrics.data ?? []).reduce(
      (acc, m) => ({
        calls: acc.calls + m.calls,
        credits: acc.credits + m.credits,
        social: acc.social + m.social,
        consignments: acc.consignments + m.consignments,
      }),
      { calls: 0, credits: 0, social: 0, consignments: 0 },
    );
  }, [metrics.data]);

  const handleDownloadDay = async () => {
    if (!reportId) return;
    setDownloadingDay(true);
    try {
      const report = await fetchDailyReportById(reportId);
      if (!report) {
        toast.error("No se encontró el informe del día.");
        return;
      }
      const leadCalls = await fetchLeadsCallsForUserDay({
        userId: report.user_id,
        reportDate: report.report_date,
      });
      await downloadVendedorReportPdf({
        fullName,
        branchName,
        reportDate,
        payload: report.payload,
        leadCalls,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setDownloadingDay(false);
    }
  };

  const handleDownloadHistory = async () => {
    setDownloadingHistory(true);
    try {
      const reports = await fetchUserReportPdfDataRange({
        userId,
        fullName,
        branchName,
        days: 30,
      });
      if (reports.length === 0) {
        toast.info("Este vendedor no tiene informes enviados en los últimos 30 días.");
        return;
      }
      await downloadUserHistoryPdf(fullName, reports);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el histórico.");
    } finally {
      setDownloadingHistory(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{fullName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {branchName ?? "Sin sucursal"} · métricas de los últimos 30 días
          </p>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SERIES.map((s) => (
              <div key={s.key} className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-semibold skale-num" style={{ color: s.color }}>
                  {totals[s.key]}
                </div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {metrics.isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando métricas...
            </div>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sin informes enviados en los últimos 30 días.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {SERIES.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={s.color}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadDay}
              disabled={!reportId || downloadingDay}
            >
              {downloadingDay ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Reporte del día
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadHistory}
              disabled={downloadingHistory}
            >
              {downloadingHistory ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Histórico (30 días)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
