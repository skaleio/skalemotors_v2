import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  useMonthlyEffectiveConsignments,
  useMyDailySalesReport,
  useSubmitDailySalesReport,
  useSyncDailySalesReportTasks,
} from "@/hooks/useDailySalesReports";
import type {
  DailyReportCallRow,
  DailyReportConsignmentRow,
  DailyReportCreditRow,
  DailyReportPlatformRow,
  DailySalesReportPayload,
} from "@/lib/types/dailySalesReport";
import {
  chileTodayIsoDate,
  CONSIGNMENT_BONUS_CLP,
  CONSIGNMENT_MONTHLY_GOAL,
  countDailyReportProgress,
  emptyCallRow,
  emptyConsignmentRow,
  emptyCreditRow,
  emptyDailySalesReportPayload,
  emptyPlatformRow,
  normalizeDailySalesReportPayload,
} from "@/lib/types/dailySalesReport";
import { cn } from "@/lib/utils";

function FieldGrid({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
}) {
  const cls = cn(
    "grid gap-3 w-full",
    cols === 1 && "grid-cols-1",
    cols === 2 && "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  );
  return <div className={cls}>{children}</div>;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function EntryCard({
  index,
  onRemove,
  canRemove,
  children,
}: {
  index: number;
  onRemove?: () => void;
  canRemove: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 relative">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Registro {index + 1}
        </span>
        {canRemove && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Quitar
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function DailySalesReportForm({
  showAllSections = false,
}: {
  showAllSections?: boolean;
}) {
  const { user } = useAuth();
  const reportDate = chileTodayIsoDate();
  const [payload, setPayload] = useState<DailySalesReportPayload>(emptyDailySalesReportPayload());
  const [openSections, setOpenSections] = useState<string[]>(["calls"]);

  useSyncDailySalesReportTasks(reportDate, !!user?.id);

  const reportQuery = useMyDailySalesReport(user?.id, reportDate, !!user?.id);
  const monthlyConsignments = useMonthlyEffectiveConsignments(user?.id, !!user?.id);
  const submitMutation = useSubmitDailySalesReport();

  useEffect(() => {
    if (reportQuery.data) {
      setPayload(normalizeDailySalesReportPayload(reportQuery.data.payload));
    }
  }, [reportQuery.data]);

  const progress = useMemo(() => countDailyReportProgress(payload), [payload]);
  const isSubmitted = !!reportQuery.data?.submitted_at;
  const formattedDate = format(new Date(`${reportDate}T12:00:00`), "EEEE d 'de' MMMM yyyy", {
    locale: es,
  });

  const monthlyConsignmentsCount = monthlyConsignments.data ?? 0;
  const consignmentGoalReached = monthlyConsignmentsCount >= CONSIGNMENT_MONTHLY_GOAL;
  const consignmentProgressPct = Math.min(
    100,
    (monthlyConsignmentsCount / CONSIGNMENT_MONTHLY_GOAL) * 100,
  );
  const consignmentBonusLabel = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(CONSIGNMENT_BONUS_CLP);

  const updateCalls = (next: DailyReportCallRow[]) =>
    setPayload((p) => ({ ...p, calls: normalizeDailySalesReportPayload({ ...p, calls: next }).calls }));
  const updateCredits = (next: DailyReportCreditRow[]) =>
    setPayload((p) => ({
      ...p,
      credits: normalizeDailySalesReportPayload({ ...p, credits: next }).credits,
    }));
  const updatePlatforms = (next: DailyReportPlatformRow[]) =>
    setPayload((p) => ({
      ...p,
      platform_uploads: normalizeDailySalesReportPayload({ ...p, platform_uploads: next })
        .platform_uploads,
    }));
  const updateConsignments = (next: DailyReportConsignmentRow[]) =>
    setPayload((p) => ({
      ...p,
      effective_consignments: normalizeDailySalesReportPayload({
        ...p,
        effective_consignments: next,
      }).effective_consignments,
    }));

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
            title: isSubmitted ? "Informe actualizado" : "Informe enviado",
            description: "Quedó registrado para supervisión.",
          }),
        onError: (err) =>
          toast({
            title: "No se pudo guardar",
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
    <div className="w-full space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-4 xl:gap-8">
            <div>
              <p className="text-sm text-muted-foreground capitalize">{formattedDate}</p>
              <p className="font-semibold text-lg mt-0.5">{user?.full_name ?? "Ejecutivo"}</p>
            </div>
            {isSubmitted ? (
              <Badge className="bg-green-600 hover:bg-green-600 gap-1 shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Enviado
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                Borrador
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {showAllSections && (
              <span>
                Progreso: {progress.sectionsFilled}/{progress.sectionsTotal} secciones
              </span>
            )}
            <span>{progress.calls} llamados</span>
            {showAllSections && (
              <>
                <span>{progress.credits} créditos</span>
                <span>{progress.platforms} publicaciones en plataformas</span>
              </>
            )}
          </div>
          {isSubmitted && reportQuery.data?.submitted_at && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Último envío:{" "}
              {format(new Date(reportQuery.data.submitted_at), "dd-MM-yyyy HH:mm", { locale: es })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-pink-300 dark:border-pink-900 bg-pink-50/50 dark:bg-pink-950/10">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-pink-500 shrink-0" />
              <div>
                <p className="font-medium text-pink-700 dark:text-pink-300">
                  Consignaciones efectivas del mes
                </p>
                <p className="text-xs text-muted-foreground">
                  {consignmentGoalReached
                    ? `¡Meta alcanzada! Bono de ${consignmentBonusLabel}`
                    : `Supera las ${CONSIGNMENT_MONTHLY_GOAL} para ganar ${consignmentBonusLabel}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-semibold skale-num text-pink-600 dark:text-pink-400">
                {monthlyConsignments.isLoading ? "…" : monthlyConsignmentsCount}
              </span>
              <span className="text-sm text-muted-foreground">/{CONSIGNMENT_MONTHLY_GOAL}</span>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-pink-100 dark:bg-pink-950">
            <div
              className="h-full rounded-full bg-pink-500 transition-all"
              style={{ width: `${consignmentProgressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="w-full space-y-2"
      >
        <AccordionItem value="calls" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              <div>
                <p className="font-medium">Llamados realizados</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {progress.calls > 0 ? `${progress.calls} registrado(s)` : "Sin registros aún"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
            {payload.calls.map((row, i) => (
              <EntryCard
                key={i}
                index={i}
                canRemove={payload.calls.length > 1}
                onRemove={() => updateCalls(payload.calls.filter((_, j) => j !== i))}
              >
                <FieldGrid cols={3}>
                  <Field label="Nombre cliente">
                    <Input
                      placeholder="Ej: Juan Pérez"
                      value={row.customer_name}
                      onChange={(e) => {
                        const next = [...payload.calls];
                        next[i] = { ...next[i], customer_name: e.target.value };
                        updateCalls(next);
                      }}
                    />
                  </Field>
                  <Field label="Teléfono">
                    <Input
                      placeholder="+56 9 ..."
                      inputMode="tel"
                      value={row.phone}
                      onChange={(e) => {
                        const next = [...payload.calls];
                        next[i] = { ...next[i], phone: e.target.value };
                        updateCalls(next);
                      }}
                    />
                  </Field>
                  <Field label="Vehículo">
                    <Input
                      placeholder="Marca / modelo"
                      value={row.vehicle}
                      onChange={(e) => {
                        const next = [...payload.calls];
                        next[i] = { ...next[i], vehicle: e.target.value };
                        updateCalls(next);
                      }}
                    />
                  </Field>
                  <Field label="Año">
                    <Input
                      placeholder="2020"
                      inputMode="numeric"
                      value={row.year}
                      onChange={(e) => {
                        const next = [...payload.calls];
                        next[i] = { ...next[i], year: e.target.value };
                        updateCalls(next);
                      }}
                    />
                  </Field>
                  <Field label="Motivo">
                    <Input
                      placeholder="Seguimiento, cotización..."
                      value={row.reason}
                      onChange={(e) => {
                        const next = [...payload.calls];
                        next[i] = { ...next[i], reason: e.target.value };
                        updateCalls(next);
                      }}
                    />
                  </Field>
                  <Field label="Resultado">
                    <Input
                      placeholder="Agendó visita, no contesta..."
                      value={row.result}
                      onChange={(e) => {
                        const next = [...payload.calls];
                        next[i] = { ...next[i], result: e.target.value };
                        updateCalls(next);
                      }}
                    />
                  </Field>
                </FieldGrid>
              </EntryCard>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full xl:col-span-2"
              onClick={() => updateCalls([...payload.calls, emptyCallRow()])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar llamado
            </Button>
          </AccordionContent>
        </AccordionItem>

        {showAllSections && (
          <>
        <AccordionItem value="credits" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                2
              </span>
              <div>
                <p className="font-medium">Créditos ingresados</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {progress.credits > 0 ? `${progress.credits} registrado(s)` : "Sin registros aún"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
            {payload.credits.map((row, i) => (
              <EntryCard
                key={i}
                index={i}
                canRemove={payload.credits.length > 1}
                onRemove={() => updateCredits(payload.credits.filter((_, j) => j !== i))}
              >
                <FieldGrid cols={2}>
                  <Field label="Nombre cliente">
                    <Input
                      value={row.customer_name}
                      onChange={(e) => {
                        const next = [...payload.credits];
                        next[i] = { ...next[i], customer_name: e.target.value };
                        updateCredits(next);
                      }}
                    />
                  </Field>
                  <Field label="RUT">
                    <Input
                      placeholder="12.345.678-9"
                      value={row.rut}
                      onChange={(e) => {
                        const next = [...payload.credits];
                        next[i] = { ...next[i], rut: e.target.value };
                        updateCredits(next);
                      }}
                    />
                  </Field>
                  <Field label="Financiera / banco">
                    <Input
                      placeholder="Ej: Santander, Forum..."
                      value={row.institution}
                      onChange={(e) => {
                        const next = [...payload.credits];
                        next[i] = { ...next[i], institution: e.target.value };
                        updateCredits(next);
                      }}
                    />
                  </Field>
                  <Field label="Estado">
                    <Input
                      placeholder="En evaluación, aprobado..."
                      value={row.status}
                      onChange={(e) => {
                        const next = [...payload.credits];
                        next[i] = { ...next[i], status: e.target.value };
                        updateCredits(next);
                      }}
                    />
                  </Field>
                </FieldGrid>
              </EntryCard>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full xl:col-span-2"
              onClick={() => updateCredits([...payload.credits, emptyCreditRow()])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar crédito
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="social" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                3
              </span>
              <div>
                <p className="font-medium">Publicaciones en redes sociales</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {payload.social_media.total_posts != null
                    ? `${payload.social_media.total_posts} publicación(es)`
                    : "Indica cantidad y vehículos"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4 xl:grid xl:grid-cols-[minmax(0,280px)_1fr] xl:gap-8 xl:items-start">
            <Field label="Cantidad total de publicaciones">
              <Input
                type="number"
                min={0}
                className="max-w-full sm:max-w-[200px]"
                placeholder="0"
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
            </Field>
            <div className="space-y-2 xl:min-w-0">
              <Label className="text-xs text-muted-foreground">Vehículos publicados</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {payload.social_media.vehicles_posted.map((v, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Vehículo ${i + 1}`}
                    value={v}
                    onChange={(e) => {
                      const vehicles = [...payload.social_media.vehicles_posted];
                      vehicles[i] = e.target.value;
                      setPayload({
                        ...payload,
                        social_media: {
                          ...payload.social_media,
                          vehicles_posted: normalizeDailySalesReportPayload({
                            ...payload,
                            social_media: { ...payload.social_media, vehicles_posted: vehicles },
                          }).social_media.vehicles_posted,
                        },
                      });
                    }}
                  />
                  {payload.social_media.vehicles_posted.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setPayload({
                          ...payload,
                          social_media: {
                            ...payload.social_media,
                            vehicles_posted: payload.social_media.vehicles_posted.filter(
                              (_, j) => j !== i,
                            ),
                          },
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  setPayload({
                    ...payload,
                    social_media: {
                      ...payload.social_media,
                      vehicles_posted: [...payload.social_media.vehicles_posted, ""],
                    },
                  })
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar vehículo
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="platforms" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                4
              </span>
              <div>
                <p className="font-medium">Vehículos subidos a plataformas</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {progress.platforms > 0
                    ? `${progress.platforms} registrado(s)`
                    : "Chileautos, Mercado Libre..."}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
            {payload.platform_uploads.map((row, i) => (
              <EntryCard
                key={i}
                index={i}
                canRemove={payload.platform_uploads.length > 1}
                onRemove={() =>
                  updatePlatforms(payload.platform_uploads.filter((_, j) => j !== i))
                }
              >
                <FieldGrid cols={2}>
                  <Field label="Vehículo">
                    <Input
                      value={row.vehicle}
                      onChange={(e) => {
                        const next = [...payload.platform_uploads];
                        next[i] = { ...next[i], vehicle: e.target.value };
                        updatePlatforms(next);
                      }}
                    />
                  </Field>
                  <Field label="Año">
                    <Input
                      inputMode="numeric"
                      value={row.year}
                      onChange={(e) => {
                        const next = [...payload.platform_uploads];
                        next[i] = { ...next[i], year: e.target.value };
                        updatePlatforms(next);
                      }}
                    />
                  </Field>
                  <Field label="Plataforma">
                    <Input
                      placeholder="Chileautos, Yapo..."
                      value={row.platform}
                      onChange={(e) => {
                        const next = [...payload.platform_uploads];
                        next[i] = { ...next[i], platform: e.target.value };
                        updatePlatforms(next);
                      }}
                    />
                  </Field>
                  <Field label="Observación">
                    <Input
                      value={row.observation}
                      onChange={(e) => {
                        const next = [...payload.platform_uploads];
                        next[i] = { ...next[i], observation: e.target.value };
                        updatePlatforms(next);
                      }}
                    />
                  </Field>
                </FieldGrid>
              </EntryCard>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full xl:col-span-2"
              onClick={() => updatePlatforms([...payload.platform_uploads, emptyPlatformRow()])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar publicación
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="observations" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                5
              </span>
              <div>
                <p className="font-medium">Observaciones del día</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {payload.daily_observations.trim()
                    ? "Con comentarios"
                    : "Notas generales de la jornada"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <Textarea
              rows={5}
              className="resize-y min-h-[120px]"
              placeholder="Ej: Cliente X pidió revisar financiamiento mañana. Inventario sin novedades..."
              value={payload.daily_observations}
              onChange={(e) => setPayload({ ...payload, daily_observations: e.target.value })}
            />
          </AccordionContent>
        </AccordionItem>
          </>
        )}

        <AccordionItem
          value="consignments"
          className="border border-pink-300 dark:border-pink-900 rounded-lg px-4 bg-pink-50/30 dark:bg-pink-950/10"
        >
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-900/40 text-xs font-bold text-pink-600 dark:text-pink-300">
                6
              </span>
              <div>
                <p className="font-medium">Consignaciones efectivas</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {progress.consignments > 0
                    ? `${progress.consignments} registrada(s) hoy · suma puntos`
                    : "Cada consignación efectiva suma 1 punto"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
            {payload.effective_consignments.map((row, i) => (
              <EntryCard
                key={i}
                index={i}
                canRemove={payload.effective_consignments.length > 1}
                onRemove={() =>
                  updateConsignments(payload.effective_consignments.filter((_, j) => j !== i))
                }
              >
                <FieldGrid cols={2}>
                  <Field label="Nombre cliente">
                    <Input
                      value={row.customer_name}
                      onChange={(e) => {
                        const next = [...payload.effective_consignments];
                        next[i] = { ...next[i], customer_name: e.target.value };
                        updateConsignments(next);
                      }}
                    />
                  </Field>
                  <Field label="Patente">
                    <Input
                      placeholder="ABCD12"
                      value={row.patente}
                      onChange={(e) => {
                        const next = [...payload.effective_consignments];
                        next[i] = { ...next[i], patente: e.target.value };
                        updateConsignments(next);
                      }}
                    />
                  </Field>
                  <Field label="Vehículo">
                    <Input
                      placeholder="Marca / modelo"
                      value={row.vehicle}
                      onChange={(e) => {
                        const next = [...payload.effective_consignments];
                        next[i] = { ...next[i], vehicle: e.target.value };
                        updateConsignments(next);
                      }}
                    />
                  </Field>
                  <Field label="Observación">
                    <Input
                      value={row.observation}
                      onChange={(e) => {
                        const next = [...payload.effective_consignments];
                        next[i] = { ...next[i], observation: e.target.value };
                        updateConsignments(next);
                      }}
                    />
                  </Field>
                </FieldGrid>
              </EntryCard>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full xl:col-span-2 border-pink-300 text-pink-600 hover:bg-pink-50 dark:border-pink-900 dark:text-pink-300"
              onClick={() =>
                updateConsignments([...payload.effective_consignments, emptyConsignmentRow()])
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar consignación
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="sticky bottom-0 z-10 mt-6 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 rounded-t-lg">
        <div className="flex items-center justify-between gap-4 py-3">
          {showAllSections && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              {progress.sectionsFilled}/{progress.sectionsTotal} secciones con datos
            </p>
          )}
          <Button
            className="ml-auto min-w-[160px]"
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSubmitted ? "Actualizar informe" : "Enviar informe"}
          </Button>
        </div>
      </div>
    </div>
  );
}
