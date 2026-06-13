import { cn } from "@/lib/utils";

/** Shell del modal — sin scroll nativo (evita barra gruesa del SO). */
export const appointmentDialogContentClass = cn(
  "flex max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-2xl border-border/55 p-0",
  "shadow-[0_28px_72px_-24px_rgba(0,0,0,0.55)]",
  "[&>button]:right-5 [&>button]:top-5 [&>button]:z-10 [&>button]:rounded-xl [&>button]:p-2",
);

/** Área scrolleable con scrollbar custom luxury soft. */
export const appointmentDialogScrollClass = cn(
  "appointment-dialog-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain",
  "px-6 py-6 sm:px-7 sm:py-7",
  "[&_input]:h-10 [&_input]:rounded-xl [&_input]:border-border/70",
  "[&_textarea]:rounded-xl [&_textarea]:border-border/70",
  "[&_[role=combobox]]:min-h-10 [&_[role=combobox]]:rounded-xl [&_[role=combobox]]:border-border/70",
);

export const appointmentFormFooterClass =
  "appointment-form-footer flex items-center justify-between gap-3 pt-1";

export const appointmentDialogFooterClass = cn(
  appointmentFormFooterClass,
  "shrink-0 border-t border-border/50 px-6 py-4 sm:px-7",
  "[&_button]:rounded-xl",
);

export const appointmentFormShellClass = "space-y-4 py-4";

export const appointmentFormSectionClass = cn(
  "space-y-2 rounded-2xl border border-border/50 bg-muted/20 p-4",
);

export const appointmentFormDateBannerClass = cn(
  "rounded-2xl border border-border/50 bg-muted/25 px-4 py-3",
);
