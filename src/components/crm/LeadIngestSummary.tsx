import { formatIngestSummaryLabel, hasIngestSummary } from "@/lib/leadNotesLegacy";

/** Resumen de la conversación del chatbot (WhatsApp/n8n), separado del seguimiento del vendedor. */
export function LeadIngestSummary({ notes }: { notes?: string | null }) {
  const summary = notes?.trim() ?? "";
  if (!hasIngestSummary(summary)) return null;

  return (
    <div className="space-y-1.5 rounded-md border border-dashed border-sky-500/25 bg-sky-500/5 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-sky-800/80 dark:text-sky-200/80">
        {formatIngestSummaryLabel()}
      </p>
      <p className="text-sm whitespace-pre-wrap text-foreground">{summary}</p>
      <p className="text-[10px] text-muted-foreground">
        Generado por WhatsApp/n8n. No reemplaza tu seguimiento por canal.
      </p>
    </div>
  );
}
