import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  Loader2,
  Phone,
  PhoneCall,
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
  DailyReportSocialPostRow,
  DailySalesReportPayload,
} from "@/lib/types/dailySalesReport";
import {
  chileTodayIsoDate,
  CONSIGNMENT_CALLS_DAILY_GOAL,
  CONSIGNMENT_MONTHLY_GOAL,
  countDailyReportProgress,
  emptyCallRow,
  emptyConsignmentRow,
  emptyCreditRow,
  emptyDailySalesReportPayload,
  emptySocialPostRow,
  normalizeDailySalesReportPayload,
} from "@/lib/types/dailySalesReport";
import { cn } from "@/lib/utils";

import { LeadCallsSection } from "@/components/tasks/LeadCallsSection";

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
      <Label className="text-xs font-medium text-foreground/80">{label}</Label>
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
    <div className="rounded-lg border-2 border-border bg-card p-4 space-y-3 relative shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
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
  const [openSections, setOpenSections] = useState<string[]>(["lead_calls", "calls"]);

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

  // Barra de llamados: sube en vivo con cada llamado que se anota en el form del día.
  const dailyCallsCount = progress.calls;
  const dailyCallsPct = Math.min(100, (dailyCallsCount / CONSIGNMENT_CALLS_DAILY_GOAL) * 100);
  const dailyGoalReached = dailyCallsCount >= CONSIGNMENT_CALLS_DAILY_GOAL;

  const updateCalls = (next: DailyReportCallRow[]) =>
    setPayload((p) => ({ ...p, calls: normalizeDailySalesReportPayload({ ...p, calls: next }).calls }));
  const updateCredits = (next: DailyReportCreditRow[]) =>
    setPayload((p) => ({
      ...p,
      credits: normalizeDailySalesReportPayload({ ...p, credits: next }).credits,
    }));
  const updateSocialPosts = (next: DailyReportSocialPostRow[]) =>
    setPayload((p) => ({
      ...p,
      social_posts: normalizeDailySalesReportPayload({ ...p, social_posts: next }).social_posts,
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
                <span>{progress.social} publicaciones en redes</span>
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

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="w-full space-y-2"
      >
        <AccordionItem value="lead_calls" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-300">
                <Phone className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="font-medium">Llamadas a leads</p>
                <p className="text-xs text-muted-foreground font-normal">
                  Se completan solas desde el CRM — no necesitas escribir nada
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <LeadCallsSection userId={user?.id} reportDate={reportDate} enabled={!!user?.id} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="calls" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3 text-left">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              <div>
                <p className="font-medium">Llamados consignación</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {progress.calls > 0 ? `${progress.calls} registrado(s)` : "Sin registros aún"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
            <div className="xl:col-span-2 rounded-lg border-2 border-pink-300 dark:border-pink-800 bg-pink-50/60 dark:bg-pink-950/15 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-5 w-5 text-pink-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-pink-700 dark:text-pink-300">
                      Llamados de hoy
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Meta diaria: {CONSIGNMENT_CALLS_DAILY_GOAL} llamados
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-2xl font-semibold skale-num text-pink-600 dark:text-pink-400">
                    {dailyCallsCount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{CONSIGNMENT_CALLS_DAILY_GOAL}
                  </span>
                </div>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-pink-100 dark:bg-pink-950">
                <div
                  className="h-full rounded-full bg-pink-500 transition-all duration-500"
                  style={{ width: `${dailyCallsPct}%` }}
                />
              </div>
              {dailyGoalReached && (
                <p className="text-xs font-medium text-pink-600 dark:text-pink-400">
                  ¡Meta diaria completa! 🎯
                </p>
              )}
            </div>
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
            <div className="rounded-lg border-2 border-pink-300 dark:border-pink-800 bg-pink-50/40 dark:bg-pink-950/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-pink-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-pink-700 dark:text-pink-300">
                      Registro bonus · Consignación efectiva
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {consignmentGoalReached
                        ? "¡Meta alcanzada! Bono de $xxx.xxx"
                        : `Supera las ${CONSIGNMENT_MONTHLY_GOAL} este mes y gana $xxx.xxx`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xl font-semibold skale-num text-pink-600 dark:text-pink-400">
                    {monthlyConsignments.isLoading ? "…" : monthlyConsignmentsCount}
                  </span>
                  <span className="text-xs text-muted-foreground">/{CONSIGNMENT_MONTHLY_GOAL}</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-pink-100 dark:bg-pink-950">
                <div
                  className="h-full rounded-full bg-pink-500 transition-all"
                  style={{ width: `${consignmentProgressPct}%` }}
                />
              </div>
              {payload.effective_consignments.map((row, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-pink-200 dark:border-pink-900/60 bg-card p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-pink-600 dark:text-pink-300">
                      Registro {payload.calls.length + i + 1} · Bonus
                    </span>
                    {payload.effective_consignments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          updateConsignments(
                            payload.effective_consignments.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Quitar
                      </Button>
                    )}
                  </div>
                  <FieldGrid cols={3}>
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
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-pink-300 text-pink-600 hover:bg-pink-50 dark:border-pink-900 dark:text-pink-300"
                onClick={() =>
                  updateConsignments([...payload.effective_consignments, emptyConsignmentRow()])
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar consignación efectiva
              </Button>
            </div>
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
                  {progress.social > 0
                    ? `${progress.social} registrado(s)`
                    : "Marca, modelo, año y URL de Facebook Marketplace"}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4 xl:grid xl:grid-cols-2 xl:gap-4 xl:space-y-0">
            {payload.social_posts.map((row, i) => (
              <EntryCard
                key={i}
                index={i}
                canRemove={payload.social_posts.length > 1}
                onRemove={() => updateSocialPosts(payload.social_posts.filter((_, j) => j !== i))}
              >
                <FieldGrid cols={2}>
                  <Field label="Marca">
                    <Input
                      placeholder="Ej: Toyota"
                      value={row.brand}
                      onChange={(e) => {
                        const next = [...payload.social_posts];
                        next[i] = { ...next[i], brand: e.target.value };
                        updateSocialPosts(next);
                      }}
                    />
                  </Field>
                  <Field label="Modelo">
                    <Input
                      placeholder="Ej: Corolla"
                      value={row.model}
                      onChange={(e) => {
                        const next = [...payload.social_posts];
                        next[i] = { ...next[i], model: e.target.value };
                        updateSocialPosts(next);
                      }}
                    />
                  </Field>
                  <Field label="Año">
                    <Input
                      placeholder="2020"
                      inputMode="numeric"
                      value={row.year}
                      onChange={(e) => {
                        const next = [...payload.social_posts];
                        next[i] = { ...next[i], year: e.target.value };
                        updateSocialPosts(next);
                      }}
                    />
                  </Field>
                  <Field label="URL publicación Facebook Marketplace">
                    <Input
                      placeholder="https://facebook.com/marketplace/..."
                      inputMode="url"
                      value={row.url}
                      onChange={(e) => {
                        const next = [...payload.social_posts];
                        next[i] = { ...next[i], url: e.target.value };
                        updateSocialPosts(next);
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
              onClick={() => updateSocialPosts([...payload.social_posts, emptySocialPostRow()])}
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
                4
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
