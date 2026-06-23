import { leadNoteService } from "@/lib/services/leadNotes";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

function formatNoteDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/**
 * Notas de seguimiento previas al modelo por canal (channel IS NULL).
 * Se muestran aparte, en solo lectura, para no perder el historial del vendedor.
 */
export function CrmLeadLegacyNotes({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(true);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["lead-notes", leadId, "legacy"],
    queryFn: () => leadNoteService.listLegacyByLead(leadId),
    enabled: !!leadId,
  });

  if (!isLoading && notes.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-border/50 bg-muted/15 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-sm font-medium text-foreground"
      >
        <span>
          Seguimiento anterior (sin canal)
          {notes.length ? ` · ${notes.length}` : ""}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open ? (
        isLoading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Cargando…
          </p>
        ) : (
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/40 bg-background/60 p-2">
            {[...notes].reverse().map((note) => {
              const authorName = note.author?.full_name?.trim() || note.author?.email?.trim();
              return (
                <article
                  key={note.id}
                  className="rounded-md border border-border/45 bg-background px-3 py-2 shadow-sm"
                >
                  <p className="text-sm whitespace-pre-wrap text-foreground">{note.body}</p>
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
        )
      ) : null}
    </div>
  );
}
