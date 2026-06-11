import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LeadScheduleCalendar } from "@/components/crm/LeadScheduleCalendar";
import {
  leadSchedulePanelClass,
  leadSchedulePopoverContentClass,
} from "@/components/crm/leadScheduleCalendarStyles";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Pencil, X } from "lucide-react";
import { useState } from "react";

type LeadCrmQuickAppointmentPickerProps = {
  id?: string;
  /** `yyyy-MM-dd` o null */
  dayKey: string | null;
  motive: string;
  onDayChange: (dayKey: string | null) => void;
  onMotiveChange: (motive: string) => void;
  disabled?: boolean;
  className?: string;
  /** Calendario mes (1–31) visible de inmediato; usado al arrastrar a AGENDADO en CRM. */
  calendarLayout?: "popover" | "inline";
};

export function LeadCrmQuickAppointmentPicker({
  id = "crm-lead-fecha",
  dayKey,
  motive,
  onDayChange,
  onMotiveChange,
  disabled,
  className,
  calendarLayout = "popover",
}: LeadCrmQuickAppointmentPickerProps) {
  const [open, setOpen] = useState(false);
  const inlineCalendar = calendarLayout === "inline";

  const selected =
    dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
      ? parse(dayKey, "yyyy-MM-dd", new Date())
      : undefined;

  const hasDate = selected && !Number.isNaN(selected.getTime());
  const dateLabel = hasDate ? format(selected, "dd/MM/yy") : null;
  const motiveTrimmed = motive.trim();

  const clearSchedule = () => {
    onDayChange(null);
    onMotiveChange("");
  };

  return (
    <fieldset
      disabled={disabled}
      className={cn(leadSchedulePanelClass, "space-y-4 p-4", disabled && "opacity-60", className)}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_55%)]"
        aria-hidden
      />

      <div className="relative flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tracking-tight text-zinc-100">
            {inlineCalendar ? "Elige el día de la cita" : "Seguimiento programado"}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {inlineCalendar
              ? "Mismo calendario que en Citas · clic en el día 1–31"
              : "Fecha + motivo · sincroniza con Citas"}
          </p>
        </div>
        <CalendarDays className="h-5 w-5 shrink-0 text-amber-500/90" aria-hidden />
      </div>

      {inlineCalendar ? (
        <div
          className={cn(
            "relative mx-auto w-full max-w-[19.5rem] overflow-hidden rounded-2xl",
            leadSchedulePopoverContentClass,
            "border border-white/10",
          )}
        >
          <LeadScheduleCalendar
            mode="single"
            locale={es}
            selected={selected}
            onSelect={(d) => {
              if (!d) return;
              onDayChange(format(d, "yyyy-MM-dd"));
            }}
            initialFocus
          />
        </div>
      ) : null}

      <div
        className={cn(
          "relative grid grid-cols-1 gap-4",
          !inlineCalendar && "sm:grid-cols-[11.5rem_minmax(0,1fr)] sm:items-end",
        )}
      >
        {!inlineCalendar ? (
          <div className="grid gap-2">
            <Label htmlFor={id} className="text-xs font-medium text-zinc-400">
              Fecha
            </Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={id}
                  type="button"
                  className={cn(
                    "h-10 w-full justify-center gap-2 rounded-xl border-0 font-medium shadow-md transition-all",
                    hasDate
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "border border-zinc-700/80 bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 hover:text-white",
                  )}
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0 opacity-90" />
                  {dateLabel ?? "Elegir fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className={leadSchedulePopoverContentClass}
                align="start"
                sideOffset={8}
              >
                <LeadScheduleCalendar
                  mode="single"
                  locale={es}
                  selected={selected}
                  onSelect={(d) => {
                    if (!d) return;
                    onDayChange(format(d, "yyyy-MM-dd"));
                    setOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}

        <div className="grid min-w-0 gap-2">
          <Label htmlFor={`${id}-motivo`} className="text-xs font-medium text-zinc-400">
            Motivo
          </Label>
          <Input
            id={`${id}-motivo`}
            value={motive}
            onChange={(e) => onMotiveChange(e.target.value)}
            disabled={!hasDate}
            className={cn(
              "h-10 rounded-xl border-zinc-700/80 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600",
              "focus-visible:ring-emerald-500/40",
              !hasDate && "cursor-not-allowed opacity-50",
            )}
            placeholder={
              hasDate ? "Ej: Cita, volver a llamar, posible compra…" : "Elige una fecha en el calendario"
            }
            maxLength={200}
          />
        </div>
      </div>

      {hasDate ? (
        <div className="relative flex items-stretch overflow-hidden rounded-xl border border-zinc-700/70 bg-zinc-900/90 shadow-inner">
          <span
            className="w-1 shrink-0 bg-emerald-500"
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
            <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-200">
              {format(selected, "dd/MM/yy")}
            </span>
            <span className="h-3 w-px shrink-0 bg-zinc-600" aria-hidden />
            <span className="truncate text-xs text-zinc-400">
              {motiveTrimmed || "Sin motivo"}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-auto w-9 shrink-0 rounded-none text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            onClick={clearSchedule}
            aria-label="Quitar fecha y motivo"
            title="Quitar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <p className="relative text-[11px] leading-snug text-zinc-500">
        Hora por defecto 10:00 en Citas; puedes cambiarla en el módulo de calendario.
      </p>
    </fieldset>
  );
}
