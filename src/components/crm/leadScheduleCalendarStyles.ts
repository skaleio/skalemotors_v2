import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Estilo mini-calendario tipo Calendar Co (popover de seguimiento lead). */
export const leadScheduleCalendarClassNames = {
  months: "flex flex-col",
  month: "space-y-3",
  caption: "flex justify-center pt-0 relative items-center mb-1",
  caption_label: "text-sm font-semibold tracking-tight text-zinc-100",
  nav: "flex items-center gap-1",
  nav_button: cn(
    buttonVariants({ variant: "ghost" }),
    "h-8 w-8 rounded-lg border border-zinc-700/80 bg-zinc-800/80 p-0 text-zinc-300 hover:bg-zinc-700 hover:text-white",
  ),
  nav_button_previous: "absolute left-0",
  nav_button_next: "absolute right-0",
  table: "w-full border-collapse",
  head_row: "flex mb-1",
  head_cell:
    "w-10 text-center text-[0.65rem] font-medium uppercase tracking-wider text-zinc-500",
  row: "flex w-full mt-1",
  cell: cn(
    "relative h-10 w-10 p-0.5 text-center text-sm",
    "[&:has([aria-selected])]:z-10",
  ),
  day: cn(
    "h-full w-full rounded-lg border border-transparent p-0 font-normal text-zinc-200",
    "hover:border-zinc-600 hover:bg-zinc-800/90",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
  ),
  day_selected:
    "border-emerald-500/60 bg-emerald-600 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.35)] hover:bg-emerald-500 hover:text-white",
  day_today:
    "border-sky-400/50 bg-sky-500/20 text-sky-100 font-semibold aria-selected:bg-emerald-600 aria-selected:text-white",
  day_outside:
    "day-outside text-zinc-600 opacity-100 aria-selected:bg-emerald-600/80 aria-selected:text-white",
  day_disabled: "text-zinc-700 opacity-40",
  day_hidden: "invisible",
};

export const leadSchedulePopoverContentClass =
  "w-auto overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-0 text-zinc-100 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl";

export const leadSchedulePanelClass = cn(
  "relative overflow-hidden rounded-2xl border border-white/[0.08]",
  "bg-gradient-to-br from-zinc-900 via-zinc-950 to-black",
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
  "text-zinc-100",
);
