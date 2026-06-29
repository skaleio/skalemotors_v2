import { leadNoteService } from "@/lib/services/leadNotes";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Phone } from "lucide-react";
import { LeadNoteAttachments } from "./LeadNoteAttachments";

function formatNoteDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const channelMeta = {
  llamada: { label: "Llamada", Icon: Phone, className: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  whatsapp: { label: "WhatsApp", Icon: MessageCircle, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
} as const;

/**
 * Vista solo-lectura de todas las notas de un lead (llamada + WhatsApp + seguimiento previo),
 * pensada para el panel de supervisión que abre el detalle de una cita.
 */
export function CrmCitaLeadNotes({ leadId }: { leadId: string }) {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["lead-notes", leadId, "all-readonly"],
    queryFn: () => leadNoteService.listByLead(leadId),
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Cargando notas…
      </p>
    );
  }

  if (notes.length === 0) {
    return <p className="text-sm text-muted-foreground">Este lead aún no tiene notas registradas.</p>;
  }

  const newestFirst = [...notes].reverse();

  return (
    <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border border-border/40 bg-background/60 p-2">
      {newestFirst.map((note) => {
        const meta = note.channel ? channelMeta[note.channel as keyof typeof channelMeta] : null;
        const authorName = note.author?.full_name?.trim() || note.author?.email?.trim();
        return (
          <article
            key={note.id}
            className="rounded-md border border-border/45 bg-background px-3 py-2 shadow-sm"
          >
            {meta ? (
              <span
                className={cn(
                  "mb-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  meta.className,
                )}
              >
                <meta.Icon className="h-3 w-3" aria-hidden />
                {meta.label}
              </span>
            ) : null}
            <p className="text-sm whitespace-pre-wrap text-foreground">{note.body}</p>
            <LeadNoteAttachments attachments={note.attachmentsResolved} />
            <div className="mt-1 space-y-0.5 text-[11px] leading-snug text-muted-foreground">
              <p>
                <span className="font-medium text-foreground/55">Registrada:</span>{" "}
                {formatNoteDate(note.created_at)}
              </p>
              {authorName ? (
                <p>
                  <span className="font-medium text-foreground/55">Por:</span>{" "}
                  <span className="text-foreground/75">{authorName}</span>
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
