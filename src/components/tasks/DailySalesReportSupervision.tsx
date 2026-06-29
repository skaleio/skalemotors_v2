import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Download, Eye, FileText, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DailyReportVendedorAnalysis } from "@/components/tasks/DailyReportVendedorAnalysis";
import { DailySalesReportForm } from "@/components/tasks/DailySalesReportForm";
import { LeadCallsSection } from "@/components/tasks/LeadCallsSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDailyReportDetail,
  useDailyReportSupervision,
  useSyncDailySalesReportTasks,
} from "@/hooks/useDailySalesReports";
import {
  downloadAllVendedorReportsZip,
  downloadGeneralReportPdf,
  downloadVendedorReportPdf,
} from "@/lib/pdf/dailyReportPdf";
import {
  fetchDailyReportById,
  fetchSubmittedReportPdfDataForDate,
} from "@/lib/services/dailySalesReports";
import type {
  DailyReportSupervisionRow,
  DailySalesReport,
} from "@/lib/types/dailySalesReport";
import { chileTodayIsoDate } from "@/lib/types/dailySalesReport";
import { cn } from "@/lib/utils";

function ReportDetailView({ report }: { report: DailySalesReport }) {
  const payload = report.payload;
  const filledCalls = payload.calls.filter((r) =>
    Object.values(r).some((v) => String(v).trim()),
  ).length;
  const filledCredits = payload.credits.filter((r) =>
    Object.values(r).some((v) => String(v).trim()),
  ).length;
  const filledConsignments = payload.effective_consignments.filter((r) =>
    Object.values(r).some((v) => String(v).trim()),
  ).length;
  const filledSocial = payload.social_posts.filter((r) =>
    Object.values(r).some((v) => String(v).trim()),
  ).length;

  return (
    <div className="space-y-4 text-sm max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <p className="mb-2 font-medium text-foreground">Llamadas a leads (CRM)</p>
        <LeadCallsSection userId={report.user_id} reportDate={report.report_date} />
      </div>
      <p>
        <span className="text-muted-foreground">Llamados consignación con datos:</span> {filledCalls}
      </p>
      <p>
        <span className="text-muted-foreground">Créditos con datos:</span> {filledCredits}
      </p>
      <p>
        <span className="text-muted-foreground">Consignaciones efectivas:</span> {filledConsignments}
      </p>
      <p>
        <span className="text-muted-foreground">Publicaciones RRSS:</span> {filledSocial}
      </p>
      {payload.daily_observations?.trim() && (
        <div>
          <p className="text-muted-foreground mb-1">Observaciones</p>
          <p className="whitespace-pre-wrap rounded-md border p-3 bg-muted/30">
            {payload.daily_observations}
          </p>
        </div>
      )}
    </div>
  );
}

export function DailySalesReportSupervision() {
  const { user } = useAuth();
  const defaultDate = chileTodayIsoDate();
  const [reportDate, setReportDate] = useState(defaultDate);
  const [viewReportId, setViewReportId] = useState<string | null>(null);

  const isAdminWide = user?.role === "admin" || user?.role === "jefe_jefe";
  const scope = isAdminWide ? "tenant" : "branch";

  useSyncDailySalesReportTasks(reportDate, !!user?.tenant_id);

  const supervision = useDailyReportSupervision({
    tenantId: user?.tenant_id,
    branchId: user?.branch_id,
    reportDate,
    scope,
    enabled: !!user?.tenant_id,
  });

  const detail = useDailyReportDetail(viewReportId, !!viewReportId);

  const [analysisRow, setAnalysisRow] = useState<DailyReportSupervisionRow | null>(null);
  const [generatingGeneral, setGeneratingGeneral] = useState(false);
  const [generatingZip, setGeneratingZip] = useState(false);

  const stats = useMemo(() => {
    const rows = supervision.data ?? [];
    const submitted = rows.filter((r) => r.status === "submitted").length;
    return { total: rows.length, submitted, pending: rows.length - submitted };
  }, [supervision.data]);

  const submittedRows = useMemo(
    () => (supervision.data ?? []).filter((r) => r.status === "submitted" && r.report_id),
    [supervision.data],
  );

  const handleGeneralReport = async () => {
    if (!user?.tenant_id) return;
    setGeneratingGeneral(true);
    try {
      const reports = await fetchSubmittedReportPdfDataForDate({
        tenantId: user.tenant_id,
        reportDate,
        branchId: user.branch_id,
        scope,
      });
      if (reports.length === 0) {
        toast.info("No hay informes enviados para esta fecha.");
        return;
      }
      await downloadGeneralReportPdf(reportDate, reports);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el reporte.");
    } finally {
      setGeneratingGeneral(false);
    }
  };

  const handleDownloadAllZip = async () => {
    if (!user?.tenant_id) return;
    setGeneratingZip(true);
    try {
      const reports = await fetchSubmittedReportPdfDataForDate({
        tenantId: user.tenant_id,
        reportDate,
        branchId: user.branch_id,
        scope,
      });
      if (reports.length === 0) {
        toast.info("No hay informes enviados para esta fecha.");
        return;
      }
      await downloadAllVendedorReportsZip(reportDate, reports);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el .zip.");
    } finally {
      setGeneratingZip(false);
    }
  };

  const handleVendedorReport = async (row: DailyReportSupervisionRow) => {
    if (!row.report_id) return;
    try {
      const report = await fetchDailyReportById(row.report_id);
      if (!report) {
        toast.error("No se encontró el informe.");
        return;
      }
      await downloadVendedorReportPdf({
        fullName: row.full_name,
        branchName: row.branch_name,
        reportDate,
        payload: report.payload,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    }
  };

  const formattedDateLabel = format(new Date(`${reportDate}T12:00:00`), "EEEE d MMMM yyyy", {
    locale: es,
  });

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-lg">Supervisión informe diario</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Revisa qué vendedores enviaron el informe del día. Solo ves datos de tu tenant
                {scope === "branch" ? " y sucursal" : ""}.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="report-date" className="text-xs">
                  Fecha
                </Label>
                <Input
                  id="report-date"
                  type="date"
                  className="h-9 w-40"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => supervision.refetch()}
                disabled={supervision.isFetching}
              >
                {supervision.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-9" disabled={generatingGeneral || generatingZip}>
                    {generatingGeneral || generatingZip ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Reportes
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto">
                  <DropdownMenuLabel>Descargar reportes de los vendedores</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={handleDownloadAllZip}
                    disabled={submittedRows.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar todos (.zip)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleGeneralReport}>
                    <FileText className="h-4 w-4 mr-2" />
                    Reporte general (1 PDF)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Descargar uno a uno</DropdownMenuLabel>
                  {submittedRows.length === 0 ? (
                    <DropdownMenuItem disabled>Nadie ha enviado aún</DropdownMenuItem>
                  ) : (
                    submittedRows.map((row) => (
                      <DropdownMenuItem
                        key={row.user_id}
                        onClick={() => handleVendedorReport(row)}
                      >
                        {row.full_name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm capitalize text-muted-foreground mb-4">{formattedDateLabel}</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-semibold skale-num">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Vendedores</div>
            </div>
            <div className="rounded-lg border border-green-200 dark:border-green-900 p-3 text-center">
              <div className="text-2xl font-semibold skale-num text-green-600 dark:text-green-400">
                {stats.submitted}
              </div>
              <div className="text-xs text-muted-foreground">Enviados</div>
            </div>
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 p-3 text-center">
              <div className="text-2xl font-semibold skale-num text-amber-600 dark:text-amber-400">
                {stats.pending}
              </div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
          </div>

          {supervision.isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando...
            </div>
          ) : (supervision.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay vendedores activos en este alcance.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide">
                    <th className="p-3">Ejecutivo</th>
                    {isAdminWide && <th className="p-3">Sucursal</th>}
                    <th className="p-3">Estado</th>
                    <th className="p-3">Hora envío</th>
                    <th className="p-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {(supervision.data ?? []).map((row) => (
                    <tr
                      key={row.user_id}
                      onClick={() => setAnalysisRow(row)}
                      className={cn(
                        "border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors",
                        row.status === "pending" && "bg-amber-50/50 dark:bg-amber-950/10",
                      )}
                    >
                      <td className="p-3 font-medium">{row.full_name}</td>
                      {isAdminWide && (
                        <td className="p-3 text-muted-foreground">{row.branch_name ?? "—"}</td>
                      )}
                      <td className="p-3">
                        {row.status === "submitted" ? (
                          <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Enviado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300">
                            <XCircle className="h-3 w-3" />
                            Pendiente
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {row.submitted_at
                          ? format(new Date(row.submitted_at), "HH:mm", { locale: es })
                          : "—"}
                      </td>
                      <td className="p-3">
                        {row.report_id ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewReportId(row.report_id);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewReportId} onOpenChange={(open) => !open && setViewReportId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del informe</DialogTitle>
          </DialogHeader>
          {detail.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : detail.data ? (
            <ReportDetailView report={detail.data} />
          ) : (
            <p className="text-sm text-muted-foreground">No se encontró el informe.</p>
          )}
        </DialogContent>
      </Dialog>

      {analysisRow && (
        <DailyReportVendedorAnalysis
          open={!!analysisRow}
          onOpenChange={(open) => !open && setAnalysisRow(null)}
          userId={analysisRow.user_id}
          fullName={analysisRow.full_name}
          branchName={analysisRow.branch_name}
          reportDate={reportDate}
          reportId={analysisRow.report_id}
        />
      )}
    </div>
  );
}

function AdminReportView() {
  const [asVendedor, setAsVendedor] = useState(false);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-end gap-3 rounded-lg border bg-card px-4 py-2.5">
        <Label htmlFor="role-preview" className="text-sm text-muted-foreground">
          Vista previa:
        </Label>
        <span className={cn("text-sm", !asVendedor && "font-semibold text-foreground")}>Admin</span>
        <Switch id="role-preview" checked={asVendedor} onCheckedChange={setAsVendedor} />
        <span className={cn("text-sm", asVendedor && "font-semibold text-foreground")}>Vendedor</span>
      </div>

      {asVendedor ? (
        <DailySalesReportForm showAllSections={false} />
      ) : (
        <div className="space-y-6">
          <DailySalesReportSupervision />
          <DailySalesReportForm showAllSections />
        </div>
      )}
    </div>
  );
}

export function DailySalesReportPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canSupervise =
    user?.role === "admin" ||
    user?.role === "jefe_jefe" ||
    user?.role === "gerente" ||
    user?.role === "jefe_sucursal";
  const canFill = user?.role === "vendedor" || user?.role === "jefe_sucursal";

  if (isAdmin) {
    return <AdminReportView />;
  }

  if (canSupervise && canFill) {
    return (
      <Tabs defaultValue="informe" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="informe">Mi informe</TabsTrigger>
          <TabsTrigger value="supervision">Supervisión equipo</TabsTrigger>
        </TabsList>
        <TabsContent value="informe">
          <DailySalesReportForm />
        </TabsContent>
        <TabsContent value="supervision">
          <DailySalesReportSupervision />
        </TabsContent>
      </Tabs>
    );
  }

  if (canSupervise) {
    return <DailySalesReportSupervision />;
  }

  if (canFill) {
    return <DailySalesReportForm />;
  }

  return (
    <p className="text-sm text-muted-foreground py-8 text-center">
      Tu rol no participa del informe diario de ventas.
    </p>
  );
}
