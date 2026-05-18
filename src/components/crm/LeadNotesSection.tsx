import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { leadNoteService } from "@/lib/services/leadNotes";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

function formatNoteDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type LeadNotesSectionProps = {
  leadId: string;
  tenantId: string | null | undefined;
  branchId?: string | null;
  /** Texto legacy en leads.notes si aún no hay filas en lead_notes */
  legacyNotes?: string | null;
  className?: string;
};

export function LeadNotesSection({ leadId, tenantId, branchId, legacyNotes, className }: LeadNotesSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const queryKey = ["lead-notes", leadId] as const;

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => leadNoteService.listByLead(leadId),
    enabled: !!leadId,
  });

  const legacyTrimmed = legacyNotes?.trim() ?? "";
  const showLegacyFallback = !isLoading && notes.length === 0 && legacyTrimmed.length > 0;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const handleSaveNote = useCallback(async () => {
    const body = draft.trim();
    if (!body) {
      toast.error("Escribe algo en la nota antes de guardar.");
      return;
    }
    if (!tenantId) {
      toast.error("No se pudo identificar el tenant para guardar la nota.");
      return;
    }

    setIsSaving(true);
    try {
      await leadNoteService.create({
        leadId,
        body,
        tenantId,
        branchId: branchId ?? user?.branch_id ?? null,
        createdBy: user?.id ?? null,
      });
      setDraft("");
      setComposerOpen(false);
      invalidate();
      toast.success("Nota agregada");
    } catch (err) {
      console.error("[LeadNotesSection] create", err);
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota.");
    } finally {
      setIsSaving(false);
    }
  }, [draft, tenantId, leadId, branchId, user?.branch_id, user?.id, invalidate]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Label>Notas de seguimiento</Label>

      <div
        className={cn(
          "max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-2",
          (notes.length > 0 || showLegacyFallback) && "min-h-[3rem]",
        )}
      >
        {isLoading ? (
          <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Cargando notas…
          </p>
        ) : null}

        {!isLoading && notes.length === 0 && !showLegacyFallback ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">Aún no hay notas. Agrega la primera con el botón de abajo.</p>
        ) : null}

        {showLegacyFallback ? (
          <article className="rounded-md border border-dashed border-border/60 bg-background/80 px-3 py-2">
            <p className="text-sm whitespace-pre-wrap text-foreground">{legacyTrimmed}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Nota anterior (sin fecha registrada)</p>
          </article>
        ) : null}

        {notes.map((note) => {
          const authorName = note.author?.full_name?.trim() || note.author?.email?.trim();
          return (
            <article
              key={note.id}
              className="rounded-md border border-border/45 bg-background/90 px-3 py-2 shadow-sm"
            >
              <p className="text-sm whitespace-pre-wrap text-foreground">{note.body}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                <time dateTime={note.created_at}>{formatNoteDate(note.created_at)}</time>
                {authorName ? (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground/70">{authorName}</span>
                  </>
                ) : null}
              </p>
            </article>
          );
        })}
      </div>

      {composerOpen ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/15 p-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe el seguimiento de esta conversación…"
            rows={3}
            autoFocus
            disabled={isSaving}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleSaveNote} disabled={isSaving || !draft.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar nota
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isSaving}
              onClick={() => {
                setComposerOpen(false);
                setDraft("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => setComposerOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Agregar nota
        </Button>
      )}
    </div>
  );
}
