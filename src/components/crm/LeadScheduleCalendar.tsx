import { Calendar } from "@/components/ui/calendar";
import { leadScheduleCalendarClassNames } from "@/components/crm/leadScheduleCalendarStyles";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type LeadScheduleCalendarProps = ComponentProps<typeof Calendar>;

/**
 * Calendario compacto con estética glass / grid oscuro (referencia Calendar Co).
 * Solo UI: la lógica de selección vive en el padre.
 */
export function LeadScheduleCalendar({ className, classNames, ...props }: LeadScheduleCalendarProps) {
  return (
    <Calendar
      showOutsideDays
      className={cn("p-4 [&_.day-outside]:bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(255,255,255,0.04)_3px,rgba(255,255,255,0.04)_6px)]", className)}
      classNames={{
        ...leadScheduleCalendarClassNames,
        ...classNames,
      }}
      {...props}
    />
  );
}
