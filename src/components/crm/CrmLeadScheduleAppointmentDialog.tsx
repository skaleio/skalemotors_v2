import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadScheduleCalendar } from "@/components/crm/LeadScheduleCalendar";
import { leadSchedulePopoverContentClass } from "@/components/crm/leadScheduleCalendarStyles";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useBranchSellers } from "@/hooks/useBranchSellers";
import { useVehicles } from "@/hooks/useVehicles";
import { resolveAppointmentCalendarScope } from "@/lib/appointmentCalendarScope";
import {
  APPOINTMENT_EVENT_TYPE_LABELS,
  APPOINTMENT_NO_SELLER,
  type AppointmentEventStatus,
  type AppointmentEventType,
  safeAppointmentEventStatus,
  safeAppointmentEventType,
} from "@/lib/appointmentEventTypes";
import {
  formatAppointmentDayLabel,
  parseTimeInput,
  safeFormatTime,
  setTimeOnDate,
} from "@/lib/appointmentFormTime";
import {
  pickActiveLeadAppointment,
  type AppointmentRow,
} from "@/lib/crmLeadQuickAppointment";
import {
  resolveDelegatableSellersScope,
  useBranchSellersOptionsFromUser,
} from "@/lib/delegatableSellersScope";
import {
  contactStateClearPatch,
  shouldClearContactStateOnVendorExitNuevo,
} from "@/lib/leadContactState";
import {
  buildAppointmentWritePayload,
  formatAppointmentSaveError,
  resolveAppointmentAssigneeId,
  resolveAppointmentTimes,
  resolveWritableAppointmentId,
} from "@/lib/appointmentWrite";
import { appointmentService } from "@/lib/services/appointments";
import { leadService } from "@/lib/services/leads";
import type { Database } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { format, parse, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CalendarDays, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

type ScheduleStep = "calendar" | "form";

type FormState = {
  title: string;
  clientPhone: string;
  vehicleId: string;
  userId: string;
  type: AppointmentEventType;
  status: AppointmentEventStatus;
  description: string;
  start: Date;
  end: Date;
};

function defaultFormTimesForDay(dayKey: string): { start: Date; end: Date } {
  const parsed = parse(dayKey, "yyyy-MM-dd", new Date());
  const start = new Date(parsed);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

function buildFormFromLead(
  lead: Lead,
  dayKey: string,
  vehicleIds: Set<string>,
  options?: { vendorUserId?: string | null; isVendor?: boolean },
): FormState {
  const { start, end } = defaultFormTimesForDay(dayKey);
  const vendorId = options?.vendorUserId?.trim() || "";
  return {
    title: lead.full_name?.trim() || "",
    clientPhone: (lead.phone || "").trim(),
    vehicleId:
      lead.preferred_vehicle_id && vehicleIds.has(lead.preferred_vehicle_id)
        ? lead.preferred_vehicle_id
        : "",
    userId: options?.isVendor
      ? vendorId
      : (lead.assigned_to?.trim() || vendorId || ""),
    type: "meeting",
    status: "programada",
    description: "",
    start,
    end,
  };
}

function buildFormFromAppointment(
  appt: AppointmentRow,
  lead: Lead,
  dayKey: string,
  vehicleIds: Set<string>,
): FormState {
  const apptDay = format(parseISO(appt.scheduled_at), "yyyy-MM-dd");
  const useApptTimes = apptDay === dayKey;

  let start: Date;
  let end: Date;
  if (useApptTimes) {
    start = parseISO(appt.scheduled_at);
    end = appt.end_at
      ? parseISO(appt.end_at)
      : new Date(start.getTime() + ((appt.duration_minutes ?? 60) * 60 * 1000));
  } else {
    ({ start, end } = defaultFormTimesForDay(dayKey));
  }

  return {
    title: appt.title?.trim() || lead.full_name?.trim() || "",
    clientPhone: (appt.client_phone || lead.phone || "").trim(),
    vehicleId:
      appt.vehicle_id && vehicleIds.has(appt.vehicle_id)
        ? appt.vehicle_id
        : lead.preferred_vehicle_id && vehicleIds.has(lead.preferred_vehicle_id)
          ? lead.preferred_vehicle_id
          : "",
    userId: appt.user_id?.trim() || lead.assigned_to?.trim() || "",
    type: safeAppointmentEventType(appt.type),
    status: safeAppointmentEventStatus(appt.status),
    description: appt.description?.trim() || "",
    start,
    end,
  };
}

type CrmLeadScheduleAppointmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onScheduled?: (updatedLead: Lead, previousStatus: string | null) => void;
};

export function CrmLeadScheduleAppointmentDialog({
  open,
  onOpenChange,
  lead,
  onScheduled,
}: CrmLeadScheduleAppointmentDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<ScheduleStep>("calendar");
  const [dayKey, setDayKey] = useState<string | null>(null);
  /** Selección visual del calendario; se limpia al volver atrás para permitir re-clic en el mismo día. */
  const [calendarSelected, setCalendarSelected] = useState<Date | undefined>();
  const [existingAppointmentId, setExistingAppointmentId] = useState<string | null>(null);
  const [existingAppointmentOwnerUserId, setExistingAppointmentOwnerUserId] = useState<
    string | null
  >(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [startTimeStr, setStartTimeStr] = useState("10:00");
  const [endTimeStr, setEndTimeStr] = useState("11:00");

  const appointmentCalendarScope = resolveAppointmentCalendarScope(user);
  const canSeeTeam = appointmentCalendarScope?.scope === "branch";
  const canSeeTenant = appointmentCalendarScope?.scope === "tenant";
  const delegateScope = resolveDelegatableSellersScope(user);
  const canDelegate = canSeeTenant || canSeeTeam || !!delegateScope;

  const sellerQuery = useBranchSellersOptionsFromUser(user, {
    enabled: open && canDelegate,
  });
  const { sellers: delegatableSellers, loading: loadingDelegatableSellers } = useBranchSellers(
    delegateScope
      ? sellerQuery
      : {
          tenantId: user?.tenant_id ?? null,
          branchId: canSeeTeam ? user?.branch_id ?? null : null,
          scope: canSeeTenant ? "tenant" : "branch",
          enabled: open && canDelegate && !!user?.tenant_id,
          roles: ["vendedor", "jefe_sucursal"],
        },
  );

  const { vehicles } = useVehicles({
    branchId: user?.branch_id ?? undefined,
    enabled: open && !!user,
  });
  const vehicleIds = useMemo(() => new Set(vehicles.map((v) => v.id)), [vehicles]);

  const resetState = useCallback(() => {
    setStep("calendar");
    setDayKey(null);
    setCalendarSelected(undefined);
    setExistingAppointmentId(null);
    setExistingAppointmentOwnerUserId(null);
    setForm(null);
    setStartTimeStr("10:00");
    setEndTimeStr("11:00");
  }, []);

  const isVendor = user?.role === "vendedor";

  useEffect(() => {
    if (!open || !lead) return;

    let cancelled = false;
    setLoadingExisting(true);
    resetState();

    void (async () => {
      try {
        const rows = await appointmentService.getAll({ leadId: lead.id });
        if (cancelled) return;
        const appt = pickActiveLeadAppointment(rows as AppointmentRow[]);
        if (appt) {
          const key = format(parseISO(appt.scheduled_at), "yyyy-MM-dd");
          setDayKey(key);
          setCalendarSelected(parse(key, "yyyy-MM-dd", new Date()));
          setExistingAppointmentId(appt.id);
          setExistingAppointmentOwnerUserId(appt.user_id ?? null);
        }
      } catch {
        if (!cancelled) {
          setDayKey(null);
          setExistingAppointmentId(null);
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, lead?.id, resetState]);

  const handleClose = () => {
    if (isSaving) return;
    resetState();
    onOpenChange(false);
  };

  const handleDaySelect = (date: Date) => {
    if (!lead) return;
    const key = format(date, "yyyy-MM-dd");
    setCalendarSelected(date);
    setDayKey(key);

    void (async () => {
      let appt: AppointmentRow | null = null;
      if (existingAppointmentId) {
        try {
          const rows = await appointmentService.getAll({ leadId: lead.id });
          appt = pickActiveLeadAppointment(rows as AppointmentRow[]) ?? null;
        } catch {
          appt = null;
        }
      }

      const nextForm = appt
        ? buildFormFromAppointment(appt, lead, key, vehicleIds)
        : buildFormFromLead(lead, key, vehicleIds, {
            isVendor,
            vendorUserId: user?.id ?? null,
          });

      if (appt) {
        setExistingAppointmentId(appt.id);
        setExistingAppointmentOwnerUserId(appt.user_id ?? null);
      }

      if (isVendor && user?.id) {
        nextForm.userId = user.id;
      } else if (!nextForm.userId && user?.id) {
        nextForm.userId = user.id;
      }

      setForm(nextForm);
      setStartTimeStr(safeFormatTime(nextForm.start) || "10:00");
      setEndTimeStr(safeFormatTime(nextForm.end) || "11:00");
      setStep("form");
    })();
  };

  const handleBackToCalendar = () => {
    setStep("calendar");
    setForm(null);
    setCalendarSelected(undefined);
  };

  const handleSave = async () => {
    if (!lead || !user || !form || !dayKey) return;

    const { start: startDate, end: endDate } = resolveAppointmentTimes({
      day: form.start,
      startTimeStr,
      endTimeStr,
      fallbackStart: form.start,
      fallbackEnd: form.end,
    });

    if (!form.title.trim()) {
      toast({
        title: "Falta el nombre",
        description: "Indica el nombre de la persona para la cita.",
        variant: "destructive",
      });
      return;
    }

    const assigneeId = resolveAppointmentAssigneeId({
      user,
      isVendor,
      canDelegate,
      formUserId: form.userId,
      leadAssignedTo: lead.assigned_to,
    });

    if (!assigneeId) {
      toast({
        title: "Falta vendedor",
        description:
          "Selecciona un vendedor para que la cita aparezca en su calendario de Citas.",
        variant: "destructive",
      });
      return;
    }

    const assigneeSeller = delegatableSellers.find((s) => s.id === assigneeId) ?? null;

    const writableAppointmentId = resolveWritableAppointmentId({
      existingId: existingAppointmentId,
      existingOwnerUserId: existingAppointmentOwnerUserId,
      currentUserId: user.id ?? null,
      isVendor,
    });

    const previousStatus = lead.status ?? null;
    setIsSaving(true);

    try {
      const payload = buildAppointmentWritePayload({
        title: form.title,
        description: form.description,
        type: form.type,
        status: form.status,
        start: startDate,
        end: endDate,
        leadId: lead.id,
        vehicleId: form.vehicleId,
        clientPhone: form.clientPhone,
        assigneeId,
        assigneeSeller,
        tenantId: lead.tenant_id ?? user.tenant_id,
        fallbackBranchId: user.branch_id,
        leadBranchId: lead.branch_id,
      });

      if (writableAppointmentId) {
        await appointmentService.update(writableAppointmentId, payload);
      } else {
        await appointmentService.create(payload);
      }

      let updatedLead = lead;
      try {
        const scheduleLeadUpdates: Record<string, unknown> = { status: "agendado" };
        if (shouldClearContactStateOnVendorExitNuevo(user?.role, previousStatus, "agendado")) {
          Object.assign(scheduleLeadUpdates, contactStateClearPatch());
        }
        updatedLead = await leadService.update(lead.id, scheduleLeadUpdates as any);
      } catch (leadErr) {
        console.error("[CrmLeadScheduleAppointmentDialog] lead status", leadErr);
        toast({
          title: "Cita guardada",
          description:
            "La cita quedó en Citas, pero no se pudo mover el lead a Agendado. Recarga el tablero.",
        });
        onScheduled?.(lead, previousStatus);
        resetState();
        onOpenChange(false);
        return;
      }

      toast({
        title: "Cita agendada",
        description: assigneeSeller
          ? `${formatAppointmentDayLabel(startDate)} · calendario de ${assigneeSeller.full_name?.trim() || "vendedor"}`
          : `${formatAppointmentDayLabel(startDate)} · visible en Citas del vendedor asignado`,
      });

      onScheduled?.(updatedLead, previousStatus);
      resetState();
      onOpenChange(false);
    } catch (err) {
      console.error("[CrmLeadScheduleAppointmentDialog] save", err);
      toast({
        title: "No se pudo guardar la cita",
        description: formatAppointmentSaveError(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCalendarDate = calendarSelected;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto",
          step === "form" ? "max-w-2xl" : "sm:max-w-[440px]",
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {step === "calendar" ? "Agendar cita" : "Nueva cita"}
          </DialogTitle>
          <DialogDescription>
            {step === "calendar"
              ? lead
                ? `Elige el día en el calendario para ${lead.full_name || "este lead"}.`
                : ""
              : "Completa la información del nuevo evento"}
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : step === "calendar" && lead ? (
          <div className="space-y-3">
            <div
              className={cn(
                "mx-auto w-full max-w-[19.5rem] overflow-hidden rounded-2xl",
                leadSchedulePopoverContentClass,
                "border border-white/10",
              )}
            >
              <LeadScheduleCalendar
                mode="single"
                locale={es}
                selected={selectedCalendarDate}
                onDayClick={(day) => handleDaySelect(day)}
                initialFocus
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Al elegir un día se abre el formulario completo de cita (como en Citas).
            </p>
          </div>
        ) : step === "form" && lead && form ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2"
                onClick={handleBackToCalendar}
                disabled={isSaving}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Cambiar fecha
              </Button>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatAppointmentDayLabel(form.start)}
              </span>
            </div>

            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/25 p-3">
              <Label>Lead</Label>
              <p className="text-sm font-medium">
                {lead.full_name || "Sin nombre"}
                {lead.phone ? ` · ${lead.phone}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Los datos del lead se completaron automáticamente. Podés editarlos abajo.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="crm-appt-title">Nombre de la persona *</Label>
                <Input
                  id="crm-appt-title"
                  placeholder="Ej: Juan Pérez"
                  value={form.title}
                  onChange={(e) => setForm((f) => (f ? { ...f, title: e.target.value } : f))}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-appt-phone">Teléfono</Label>
                <Input
                  id="crm-appt-phone"
                  type="tel"
                  placeholder="Ej: +56912345678"
                  value={form.clientPhone}
                  onChange={(e) => setForm((f) => (f ? { ...f, clientPhone: e.target.value } : f))}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Vehículo (opcional)</Label>
              <Select
                value={form.vehicleId || "none"}
                onValueChange={(value) =>
                  setForm((f) => (f ? { ...f, vehicleId: value === "none" ? "" : value } : f))
                }
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un vehículo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vehículo</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} {vehicle.year ? vehicle.year : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="crm-appt-start">Hora Inicio * (24h, ej. 16:00)</Label>
                <Input
                  id="crm-appt-start"
                  placeholder="ej. 16:00"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  onBlur={() => {
                    const parsed = parseTimeInput(startTimeStr);
                    if (parsed) {
                      setStartTimeStr(parsed);
                      setForm((f) =>
                        f ? { ...f, start: setTimeOnDate(f.start, parsed) } : f,
                      );
                    }
                  }}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crm-appt-end">Hora Fin * (24h, ej. 17:30)</Label>
                <Input
                  id="crm-appt-end"
                  placeholder="ej. 17:30"
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  onBlur={() => {
                    const parsed = parseTimeInput(endTimeStr);
                    if (parsed) {
                      setEndTimeStr(parsed);
                      setForm((f) =>
                        f ? { ...f, end: setTimeOnDate(f.start, parsed) } : f,
                      );
                    }
                  }}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Evento *</Label>
              <Select
                value={form.type}
                onValueChange={(value: AppointmentEventType) =>
                  setForm((f) => (f ? { ...f, type: value } : f))
                }
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(APPOINTMENT_EVENT_TYPE_LABELS) as AppointmentEventType[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {APPOINTMENT_EVENT_TYPE_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(value: AppointmentEventStatus) =>
                  setForm((f) => (f ? { ...f, status: value } : f))
                }
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="programada">Programada</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {canDelegate ? (
              <div className="space-y-2">
                <Label>Vendedor asignado</Label>
                <Select
                  value={form.userId?.trim() ? form.userId : APPOINTMENT_NO_SELLER}
                  onValueChange={(value) =>
                    setForm((f) =>
                      f ? { ...f, userId: value === APPOINTMENT_NO_SELLER ? "" : value } : f,
                    )
                  }
                  disabled={isSaving || loadingDelegatableSellers}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingDelegatableSellers
                          ? "Cargando vendedores…"
                          : "Seleccionar vendedor"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={APPOINTMENT_NO_SELLER}>Sin asignar</SelectItem>
                    {delegatableSellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.full_name?.trim() || seller.email || "Vendedor"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  La cita se mostrará en el calendario del vendedor elegido.
                </p>
              </div>
            ) : isVendor ? (
              <div className="space-y-1 rounded-lg border border-border/80 bg-muted/25 p-3">
                <Label>Vendedor asignado</Label>
                <p className="text-sm font-medium">
                  {user?.full_name?.trim() || user?.email || "Tu usuario"}
                </p>
                <p className="text-xs text-muted-foreground">
                  La cita quedará en tu calendario de Citas. Tu admin la verá en la vista de la automotora.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="crm-appt-desc">Descripción</Label>
              <Textarea
                id="crm-appt-desc"
                placeholder="Notas adicionales sobre el evento..."
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, description: e.target.value } : f))
                }
                disabled={isSaving}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          {step === "form" ? (
            <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !form}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar cita"
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
