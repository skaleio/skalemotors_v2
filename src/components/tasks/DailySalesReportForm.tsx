import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  useMyDailySalesReport,
  useSubmitDailySalesReport,
  useSyncDailySalesReportTasks,
} from "@/hooks/useDailySalesReports";
import type { DailySalesReportPayload } from "@/lib/types/dailySalesReport";
import {
  chileTodayIsoDate,
  emptyDailySalesReportPayload,
  normalizeDailySalesReportPayload,
} from "@/lib/types/dailySalesReport";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-primary/90 px-3 py-2 text-sm font-semibold text-primary-foreground">
      {children}
    </div>
  );
}

export function DailySalesReportForm() {
  const { user } = useAuth();
  const reportDate = chileTodayIsoDate();
  const [payload, setPayload] = useState<DailySalesReportPayload>(emptyDailySalesReportPayload());

  useSyncDailySalesReportTasks(reportDate, !!user?.id);

  const reportQuery = useMyDailySalesReport(user?.id, reportDate, !!user?.id);
  const submitMutation = useSubmitDailySalesReport();

  useEffect(() => {
    if (reportQuery.data) {
      setPayload(normalizeDailySalesReportPayload(reportQuery.data.payload));
    }
  }, [reportQuery.data]);

  const isSubmitted = !!reportQuery.data?.submitted_at;
  const formattedDate = format(new Date(`${reportDate}T12:00:00`), "dd-MM-yyyy", { locale: es });

  const handleSubmit = () => {
    if (!user?.id || !user.tenant_id) {
      toast({ title: "Sesión inválida", variant: "destructive" });
      return;
    }
    if (!user.branch_id) {
      toast({
        title: "Sin sucursal asignada",
        description: "Tu usuario debe tener sucursal para enviar el informe diario.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(
      {
        tenantId: user.tenant_id,
        branchId: user.branch_id,
        userId: user.id,
        reportDate,
        payload,
        existingId: reportQuery.data?.id ?? null,
      },
      {
        onSuccess: () =>
          toast({
            title: "Informe enviado",
            description: "Tu informe diario quedó registrado y la tarea se marcó como completada.",
          }),
        onError: (err) =>
          toast({
            title: "No se pudo enviar",
            description: err instanceof Error ? err.message : "Error desconocido",
            variant: "destructive",
          }),
      },
    );
  };

  if (reportQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando informe...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Informe diario equipo de ventas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Fecha: <span className="font-medium text-foreground">{formattedDate}</span>
            {" · "}
            Ejecutivo: <span className="font-medium text-foreground">{user?.full_name ?? "—"}</span>
            {" · "}
            Sucursal: <span className="font-medium text-foreground">{user?.branch_id ? "Asignada" : "—"}</span>
          </p>
          {isSubmitted && reportQuery.data?.submitted_at && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Enviado el{" "}
              {format(new Date(reportQuery.data.submitted_at), "dd-MM-yyyy HH:mm", { locale: es })}
              . Puedes actualizarlo y volver a guardar si hubo cambios.
            </p>
          )}
        </CardHeader>
      </Card>

      <section className="space-y-3">
        <SectionHeader>1. Llamados realizados</SectionHeader>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide">
                <th className="p-2 w-10">N°</th>
                <th className="p-2 min-w-[120px]">Nombre cliente</th>
                <th className="p-2 min-w-[100px]">Teléfono</th>
                <th className="p-2 min-w-[100px]">Vehículo</th>
                <th className="p-2 w-16">Año</th>
                <th className="p-2 min-w-[100px]">Motivo</th>
                <th className="p-2 min-w-[100px]">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {payload.calls.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  {(["customer_name", "phone", "vehicle", "year", "reason", "result"] as const).map(
                    (field) => (
                      <td key={field} className="p-1">
                        <Input
                          className="h-8 text-xs"
                          value={row[field]}
                          onChange={(e) => {
                            const next = [...payload.calls];
                            next[i] = { ...next[i], [field]: e.target.value };
                            setPayload({ ...payload, calls: next });
                          }}
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader>2. Créditos ingresados</SectionHeader>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide">
                <th className="p-2 w-10">N°</th>
                <th className="p-2">Nombre cliente</th>
                <th className="p-2 w-28">RUT</th>
                <th className="p-2">Financiera / banco</th>
                <th className="p-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {payload.credits.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  {(["customer_name", "rut", "institution", "status"] as const).map((field) => (
                    <td key={field} className="p-1">
                      <Input
                        className="h-8 text-xs"
                        value={row[field]}
                        onChange={(e) => {
                          const next = [...payload.credits];
                          next[i] = { ...next[i], [field]: e.target.value };
                          setPayload({ ...payload, credits: next });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader>3. Publicaciones en redes sociales</SectionHeader>
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="total-posts" className="text-sm shrink-0">
                Cantidad total de publicaciones realizadas
              </Label>
              <Input
                id="total-posts"
                type="number"
                min={0}
                className="w-24 h-9"
                value={payload.social_media.total_posts ?? ""}
                onChange={(e) =>
                  setPayload({
                    ...payload,
                    social_media: {
                      ...payload.social_media,
                      total_posts: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Vehículos publicados</Label>
              {payload.social_media.vehicles_posted.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                  <Input
                    className="h-8 text-sm"
                    value={v}
                    placeholder="Marca / modelo"
                    onChange={(e) => {
                      const vehicles = [...payload.social_media.vehicles_posted];
                      vehicles[i] = e.target.value;
                      setPayload({
                        ...payload,
                        social_media: { ...payload.social_media, vehicles_posted: vehicles },
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeader>4. Vehículos subidos a plataformas</SectionHeader>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide">
                <th className="p-2 w-10">N°</th>
                <th className="p-2">Vehículo</th>
                <th className="p-2 w-16">Año</th>
                <th className="p-2">Plataforma publicada</th>
                <th className="p-2">Observación</th>
              </tr>
            </thead>
            <tbody>
              {payload.platform_uploads.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-2 text-muted-foreground">{i + 1}</td>
                  {(["vehicle", "year", "platform", "observation"] as const).map((field) => (
                    <td key={field} className="p-1">
                      <Input
                        className="h-8 text-xs"
                        value={row[field]}
                        onChange={(e) => {
                          const next = [...payload.platform_uploads];
                          next[i] = { ...next[i], [field]: e.target.value };
                          setPayload({ ...payload, platform_uploads: next });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader>5. Observaciones del día</SectionHeader>
        <Textarea
          rows={5}
          placeholder="Comentarios generales sobre la jornada..."
          value={payload.daily_observations}
          onChange={(e) => setPayload({ ...payload, daily_observations: e.target.value })}
        />
      </section>

      <div className="flex justify-end pb-8">
        <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
          {submitMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isSubmitted ? "Actualizar informe" : "Enviar informe del día"}
        </Button>
      </div>
    </div>
  );
}
