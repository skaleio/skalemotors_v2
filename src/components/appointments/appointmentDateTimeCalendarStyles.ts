import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Celdas cuadradas con esquinas redondeadas (referencia visual soft grid). */
export const appointmentDateTimeCalendarClassNames = {
  months: "flex flex-col",
  month: "space-y-3",
  caption: "flex justify-center pt-0 relative items-center mb-0.5",
  caption_label: "text-sm font-semibold tracking-tight capitalize",
  nav: "flex items-center gap-1",
  nav_button: cn(
    buttonVariants({ variant: "ghost" }),
    "h-8 w-8 rounded-xl p-0 text-muted-foreground hover:bg-muted/80 hover:text-foreground",
  ),
  nav_button_previous: "absolute left-0",
  nav_button_next: "absolute right-0",
  table: "w-full border-collapse",
  head_row: "flex mb-1.5 gap-1",
  head_cell:
    "w-11 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground",
  row: "flex w-full mt-1 gap-1",
  cell: cn(
    "relative h-11 w-11 p-0.5 text-center text-sm",
    "[&:has([aria-selected])]:z-10",
  ),
  day: cn(
    "flex h-full w-full items-start justify-start rounded-2xl border border-border/40 p-1.5",
    "text-sm font-semibold tabular-nums skale-num",
    "bg-secondary text-foreground",
    "hover:border-border hover:bg-muted",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chart-1/35",
  ),
  day_selected: cn(
    "rounded-2xl border-transparent bg-[hsl(var(--chart-1)/0.35)] text-foreground",
    "shadow-[0_6px_18px_-4px_hsl(var(--chart-1)/0.4)]",
    "hover:bg-[hsl(var(--chart-1)/0.42)] hover:text-foreground",
    "focus:bg-[hsl(var(--chart-1)/0.35)] focus:text-foreground",
  ),
  day_today: cn(
    "rounded-2xl border-[hsl(var(--chart-1)/0.35)] bg-[hsl(var(--chart-1)/0.12)] font-bold text-foreground",
    "aria-selected:bg-[hsl(var(--chart-1)/0.35)] aria-selected:text-foreground aria-selected:shadow-[0_6px_18px_-4px_hsl(var(--chart-1)/0.4)]",
  ),
  day_outside:
    "day-outside rounded-2xl bg-muted/60 text-muted-foreground opacity-80 aria-selected:bg-[hsl(var(--chart-1)/0.28)] aria-selected:text-foreground",
  day_disabled: "rounded-2xl bg-muted/30 text-muted-foreground opacity-40",
  day_hidden: "invisible",
};

export const appointmentDateTimePopoverClass =
  "w-auto overflow-hidden rounded-2xl border border-border/60 bg-popover p-0 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)]";

export const appointmentDateTimeCalendarShellClass = cn(
  "rounded-none border-0 bg-transparent p-4",
  /* Domingo — última columna (semana empieza lunes) */
  "[&_.row>.cell:last-child_button]:text-destructive/85",
  "[&_.head_row>.head_cell:last-child]:text-destructive/70",
);
