import { Button } from "@/components/ui/button";
import {
  appointmentDateTimeCalendarClassNames,
  appointmentDateTimeCalendarShellClass,
  appointmentDateTimePopoverClass,
} from "@/components/appointments/appointmentDateTimeCalendarStyles";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatAppointmentDateTimeLabel,
  parseTimeInput,
  safeFormatTime,
  setTimeOnDate,
} from "@/lib/appointmentDateTime";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

const QUICK_TIMES = ["09:00", "10:00", "11:00", "16:00", "17:00", "18:00"] as const;

interface AppointmentDateTimeFieldProps {
  id?: string;
  label: string;
  value: Date | undefined;
  onChange: (date: Date) => void;
  disabled?: boolean;
  /** Renderizar el popover dentro del modal (evita clipping / z-index). */
  portalContainer?: HTMLElement | null;
}

export function AppointmentDateTimeField({
  id,
  label,
  value,
  onChange,
  disabled,
  portalContainer,
}: AppointmentDateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const [timeStr, setTimeStr] = useState(() => safeFormatTime(value) || "10:00");

  useEffect(() => {
    setTimeStr(safeFormatTime(value) || "10:00");
  }, [value]);

  const selectedDay =
    value && !isNaN(value.getTime()) ? startOfDay(value) : undefined;

  const applyTime = (nextTime: string) => {
    const parsed = parseTimeInput(nextTime);
    if (!parsed) return;
    setTimeStr(parsed);
    const base = value && !isNaN(value.getTime()) ? value : new Date();
    onChange(setTimeOnDate(base, parsed));
  };

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    const parsed = parseTimeInput(timeStr) ?? "10:00";
    onChange(setTimeOnDate(day, parsed));
  };

  const commitTimeInput = () => {
    const parsed = parseTimeInput(timeStr);
    if (parsed == null) {
      setTimeStr(safeFormatTime(value) || "10:00");
      return;
    }
    setTimeStr(parsed);
    const base = value && !isNaN(value.getTime()) ? value : new Date();
    onChange(setTimeOnDate(base, parsed));
  };

  const setToday = () => {
    const parsed = parseTimeInput(timeStr) ?? "10:00";
    onChange(setTimeOnDate(startOfDay(new Date()), parsed));
  };

  const displayLabel = formatAppointmentDateTimeLabel(value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-xl px-3 font-normal",
              !displayLabel && "text-muted-foreground",
            )}
          >
            <CalendarClock className="h-4 w-4 shrink-0 opacity-70" />
            <span className="skale-num truncate tabular-nums">
              {displayLabel || "Elegir fecha y hora"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={appointmentDateTimePopoverClass}
          align="start"
          side="bottom"
          container={portalContainer}
        >
          <div className="flex flex-col sm:flex-row">
            <Calendar
              mode="single"
              locale={es}
              selected={selectedDay}
              onSelect={handleDaySelect}
              initialFocus
              className={appointmentDateTimeCalendarShellClass}
              classNames={appointmentDateTimeCalendarClassNames}
            />
            <div className="flex min-w-[10.5rem] flex-col justify-between border-t bg-muted/20 sm:border-l sm:border-t-0">
              <div className="space-y-3 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Hora (24h)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={setToday}
                  >
                    Hoy
                  </Button>
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="ej. 16:00"
                  value={timeStr}
                  className="skale-num h-9 tabular-nums"
                  onChange={(e) => setTimeStr(e.target.value)}
                  onBlur={commitTimeInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTimeInput();
                      setOpen(false);
                    }
                  }}
                />
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_TIMES.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={timeStr === t ? "secondary" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs skale-num tabular-nums"
                      onClick={() => applyTime(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
              {selectedDay ? (
                <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                  {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
                </p>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
