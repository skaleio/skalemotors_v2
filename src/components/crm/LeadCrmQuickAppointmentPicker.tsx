import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatLeadScheduleDisplayLine } from "@/lib/crmLeadQuickAppointment";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
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
};

export function LeadCrmQuickAppointmentPicker({
  id = "crm-lead-fecha",
  dayKey,
  motive,
  onDayChange,
  onMotiveChange,
  disabled,
  className,
}: LeadCrmQuickAppointmentPickerProps) {
  const [open, setOpen] = useState(false);

  const selected =
    dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
      ? parse(dayKey, "yyyy-MM-dd", new Date())
      : undefined;

  const hasDate = selected && !Number.isNaN(selected.getTime());
  const previewLine = hasDate
    ? formatLeadScheduleDisplayLine(
        new Date(`${dayKey}T12:00:00`).toISOString(),
        motive,
      )
    : null;

  const clearSchedule = () => {
    onDayChange(null);
    onMotiveChange("");
  };

  return (
    <fieldset
      disabled={disabled}
      className={cn(
        "rounded-lg border border-border/70 bg-muted/25 p-3 space-y-3",
        disabled && "opacity-60",
        className,
      )}
    >
      <legend className="px-1 text-sm font-medium leading-none">Seguimiento programado</legend>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={id}>Fecha</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id={id}
                type="button"
                variant="outline"
                className={cn(
                  "h-10 w-full justify-start gap-2 font-normal",
                  !hasDate && "text-muted-foreground",
                )}
              >
                <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
                {hasDate ? format(selected, "dd/MM/yy") : "Elegir fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
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

        <div className="grid gap-2 min-w-0">
          <Label htmlFor={`${id}-motivo`}>Motivo</Label>
          <Input
            id={`${id}-motivo`}
            value={motive}
            onChange={(e) => onMotiveChange(e.target.value)}
            disabled={!hasDate}
            className="h-10"
            placeholder={
              hasDate
                ? "Ej: Cita, volver a llamar, posible compra…"
                : "Primero elige una fecha"
            }
            maxLength={200}
          />
        </div>
      </div>

      {previewLine ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-sm font-medium text-foreground truncate">{previewLine}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={clearSchedule}
            aria-label="Quitar fecha y motivo"
            title="Quitar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <p className="text-[11px] leading-snug text-muted-foreground">
        También aparece en Citas (10:00 por defecto; puedes ajustar la hora en el calendario).
      </p>
    </fieldset>
  );
}
