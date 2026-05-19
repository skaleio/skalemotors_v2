import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

type LeadCrmQuickAppointmentPickerProps = {
  id?: string;
  /** `yyyy-MM-dd` o null */
  dayKey: string | null;
  onDayChange: (dayKey: string | null) => void;
  disabled?: boolean;
  className?: string;
};

export function LeadCrmQuickAppointmentPicker({
  id = "crm-lead-cita",
  dayKey,
  onDayChange,
  disabled,
  className,
}: LeadCrmQuickAppointmentPickerProps) {
  const [open, setOpen] = useState(false);

  const selected =
    dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
      ? parse(dayKey, "yyyy-MM-dd", new Date())
      : undefined;

  const labelShort =
    selected && !Number.isNaN(selected.getTime())
      ? format(selected, "dd/MM/yy")
      : null;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>Cita agendada</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn("h-9 justify-start gap-2 px-3 font-normal", !labelShort && "text-muted-foreground")}
            >
              <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
              {labelShort ? `CITA: ${labelShort}` : "Elegir fecha"}
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
        {labelShort ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            disabled={disabled}
            onClick={() => onDayChange(null)}
          >
            Quitar cita
          </Button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Se crea un evento en Citas vinculado a este lead (hora por defecto 10:00; puedes ajustarla en el calendario).
      </p>
    </div>
  );
}
