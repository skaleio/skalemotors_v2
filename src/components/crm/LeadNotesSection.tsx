import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { leadNoteService } from "@/lib/services/leadNotes";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

function formatNoteDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function wasEdited(createdAt: string, updatedAt: string | null | undefined) {
  if (!updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}

function NoteTimestamps({
  createdAt,
  updatedAt,
  authorName,
}: {
  createdAt: string;
  updatedAt?: string | null;
  authorName?: string | null;
}) {
  const edited = wasEdited(createdAt, updatedAt);

  return (
    <div className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-muted-foreground">
      <p>
        <span className="font-medium text-foreground/55">Creada:</span>{" "}
        <time dateTime={createdAt} className="text-foreground/75">
          {formatNoteDate(createdAt)}
        </time>
      </p>
      {edited && updatedAt ? (
        <p>
          <span className="font-medium text-foreground/55">Última edición:</span>{" "}
          <time dateTime={updatedAt} className="text-foreground/75">
            {formatNoteDate(updatedAt)}
          </time>
        </p>
      ) : null}
      {authorName ? (
        <p>
          <span className="font-medium text-foreground/55">Registrada por:</span>{" "}
          <span className="text-foreground/75">{authorName}</span>
        </p>
      ) : null}
    </div>
  );
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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
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

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setDraft("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditDraft("");
  }, []);

  const startEdit = useCallback(
    (noteId: string, body: string) => {
      setEditingNoteId(noteId);
      setEditDraft(body);
      closeComposer();
    },
    [closeComposer],
  );

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
      closeComposer();
      invalidate();
      toast.success("Nota agregada");
    } catch (err) {
      console.error("[LeadNotesSection] create", err);
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota.");
    } finally {
      setIsSaving(false);
    }
  }, [draft, tenantId, leadId, branchId, user?.branch_id, user?.id, invalidate, closeComposer]);

  const handleUpdateNote = useCallback(async () => {
    if (!editingNoteId) return;
    const body = editDraft.trim();
    if (!body) {
      toast.error("La nota no puede quedar vacía.");
      return;
    }

    setIsSaving(true);
    try {
      await leadNoteService.update(editingNoteId, body);
      cancelEdit();
      invalidate();
      toast.success("Nota actualizada");
    } catch (err) {
      console.error("[LeadNotesSection] update", err);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la nota.");
    } finally {
      setIsSaving(false);
    }
  }, [editingNoteId, editDraft, cancelEdit, invalidate]);

  const openAddComposer = useCallback(() => {
    cancelEdit();
    setComposerOpen(true);
  }, [cancelEdit]);

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
          const isEditing = editingNoteId === note.id;

          if (isEditing) {
            return (
              <div
                key={note.id}
                className="space-y-2 rounded-md border border-primary/30 bg-background px-3 py-2 shadow-sm"
              >
                <Textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={3}
                  autoFocus
                  disabled={isSaving}
                  aria-label="Editar nota"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={handleUpdateNote} disabled={isSaving || !editDraft.trim()}>
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Guardar cambios
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled={isSaving} onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </div>
                <NoteTimestamps
                  createdAt={note.created_at}
                  updatedAt={note.updated_at}
                  authorName={authorName}
                />
              </div>
            );
          }

          return (
            <article
              key={note.id}
              className="group relative rounded-md border border-border/45 bg-background/90 px-3 py-2 pr-10 shadow-sm"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                onClick={() => startEdit(note.id, note.body)}
                disabled={isSaving || composerOpen}
                aria-label="Editar nota"
                title="Editar nota"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <p className="text-sm whitespace-pre-wrap text-foreground">{note.body}</p>
              <NoteTimestamps
                createdAt={note.created_at}
                updatedAt={note.updated_at}
                authorName={authorName}
              />
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
            <Button type="button" size="sm" variant="ghost" disabled={isSaving} onClick={closeComposer}>
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
          onClick={openAddComposer}
          disabled={isSaving || editingNoteId !== null}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Agregar nota
        </Button>
      )}
    </div>
  );
}
