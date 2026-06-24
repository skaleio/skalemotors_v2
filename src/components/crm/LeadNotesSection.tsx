import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmDialog, type ConfirmOptions } from "@/hooks/useConfirmDialog";
import { leadNoteService } from "@/lib/services/leadNotes";
import { formatIngestSummaryLabel, hasIngestSummary } from "@/lib/leadNotesLegacy";
import { selectValidAttachments } from "@/lib/leadNoteAttachments";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LeadNoteAttachments } from "./LeadNoteAttachments";

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

export type LeadNotesSectionHandle = {
  hasPendingDraft: () => boolean;
  /** Guarda el borrador si hay texto. Devuelve false si falló. */
  savePendingDraft: () => Promise<boolean>;
};

type LeadNotesSectionProps = {
  leadId: string;
  tenantId: string | null | undefined;
  branchId?: string | null;
  legacyNotes?: string | null;
  className?: string;
  /** Evita un segundo diálogo de confirmación dentro del modal del CRM. */
  askConfirm?: (opts: ConfirmOptions) => Promise<boolean>;
};

export const LeadNotesSection = forwardRef<LeadNotesSectionHandle, LeadNotesSectionProps>(
  function LeadNotesSection(
    { leadId, tenantId, branchId, legacyNotes, className, askConfirm: askConfirmProp },
    ref,
  ) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const internalConfirm = useConfirmDialog();
    const askConfirm = askConfirmProp ?? internalConfirm.confirm;

    const [draft, setDraft] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const previews = useMemo(
      () => selectedFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
      [selectedFiles],
    );

    useEffect(() => {
      return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
    }, [previews]);

    const handlePickFiles = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const list = Array.from(event.target.files ?? []);
        event.target.value = ""; // permite volver a elegir el mismo archivo
        if (!list.length) return;
        setSelectedFiles((prev) => {
          const { accepted, rejected } = selectValidAttachments({
            files: list,
            existingCount: prev.length,
          });
          if (rejected.length) toast.error(rejected[0].reason);
          return accepted.length ? [...prev, ...accepted] : prev;
        });
      },
      [],
    );

    const removeSelectedFile = useCallback((index: number) => {
      setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const canDeleteNotes =
      user?.role === "admin"
      || user?.role === "gerente"
      || user?.role === "jefe_jefe"
      || user?.role === "jefe_sucursal";

    const queryKey = ["lead-notes", leadId] as const;

    const { data: notes = [], isLoading, isError, error, refetch } = useQuery({
      queryKey,
      queryFn: () => leadNoteService.listByLead(leadId),
      enabled: !!leadId,
      retry: 2,
    });

    const notesNewestFirst = useMemo(() => [...notes].reverse(), [notes]);

    const ingestSummary = legacyNotes?.trim() ?? "";
    const showIngestSummary = hasIngestSummary(ingestSummary);

    useEffect(() => {
      setDraft("");
      setSelectedFiles([]);
      setEditingNoteId(null);
      setEditDraft("");
    }, [leadId]);

    const errorToastShownRef = useRef(false);

    useEffect(() => {
      if (!isError) {
        errorToastShownRef.current = false;
        return;
      }
      if (errorToastShownRef.current) return;
      errorToastShownRef.current = true;
      console.error("[LeadNotesSection] load", error);
      toast.error("No se pudieron cargar las notas del lead. Intenta de nuevo.");
    }, [isError, error]);

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["seller-engagement"] });
    }, [queryClient, queryKey]);

    const cancelEdit = useCallback(() => {
      setEditingNoteId(null);
      setEditDraft("");
    }, []);

    const persistNewNote = useCallback(
      async (body: string, files: File[]): Promise<boolean> => {
        const trimmed = body.trim();
        if (!trimmed && !files.length) return true;
        if (!tenantId) {
          toast.error("No se pudo identificar el tenant para guardar la nota.");
          return false;
        }

        setIsSaving(true);
        try {
          const cached = queryClient.getQueryData<typeof notes>(queryKey) ?? notes;
          const appended: typeof notes = [...cached];

          const created = await leadNoteService.create({
            leadId,
            body: trimmed,
            tenantId,
            branchId: branchId ?? user?.branch_id ?? null,
            createdBy: user?.id ?? null,
            files,
          });
          appended.push(created);

          queryClient.setQueryData(queryKey, appended);
          setDraft("");
          setSelectedFiles([]);
          cancelEdit();
          await queryClient.refetchQueries({ queryKey });
          invalidate();
          return true;
        } catch (err) {
          console.error("[LeadNotesSection] create", err);
          toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota.");
          return false;
        } finally {
          setIsSaving(false);
        }
      },
      [
        tenantId,
        leadId,
        branchId,
        user?.branch_id,
        user?.id,
        queryClient,
        queryKey,
        notes,
        invalidate,
        cancelEdit,
      ],
    );

    const handleSaveNote = useCallback(async () => {
      const hadContent = draft.trim().length > 0 || selectedFiles.length > 0;
      const ok = await persistNewNote(draft, selectedFiles);
      if (ok && hadContent) toast.success("Nota agregada");
    }, [draft, selectedFiles, persistNewNote]);

    const handleUpdateNote = useCallback(async () => {
      if (!editingNoteId) return;
      const body = editDraft.trim();
      if (!body) {
        toast.error("La nota no puede quedar vacía.");
        return;
      }

      setIsSaving(true);
      try {
        const updated = await leadNoteService.update(editingNoteId, body);
        queryClient.setQueryData(queryKey, (current: typeof notes | undefined) =>
          (current ?? []).map((n) => (n.id === updated.id ? updated : n)),
        );
        cancelEdit();
        invalidate();
        toast.success("Nota actualizada");
      } catch (err) {
        console.error("[LeadNotesSection] update", err);
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la nota.");
      } finally {
        setIsSaving(false);
      }
    }, [editingNoteId, editDraft, cancelEdit, invalidate, queryClient, queryKey]);

    const handleDeleteNote = useCallback(
      async (noteId: string) => {
        const ok = await askConfirm({
          title: "¿Eliminar esta nota?",
          description:
            "Se quitará de la vista activa, pero quedará respaldada en el historial del lead.",
          confirmLabel: "Eliminar",
          destructive: true,
        });
        if (!ok) return;

        setDeletingNoteId(noteId);
        try {
          await leadNoteService.delete(noteId);
          if (editingNoteId === noteId) cancelEdit();
          queryClient.setQueryData(queryKey, (current: typeof notes | undefined) =>
            (current ?? []).filter((n) => n.id !== noteId),
          );
          invalidate();
          toast.success("Nota eliminada");
        } catch (err) {
          console.error("[LeadNotesSection] delete", err);
          toast.error(err instanceof Error ? err.message : "No se pudo eliminar la nota.");
        } finally {
          setDeletingNoteId(null);
        }
      },
      [askConfirm, editingNoteId, cancelEdit, invalidate, queryClient, queryKey],
    );

    const startEdit = useCallback((noteId: string, body: string) => {
      setEditingNoteId(noteId);
      setEditDraft(body);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        hasPendingDraft: () => draft.trim().length > 0 || selectedFiles.length > 0,
        savePendingDraft: () => persistNewNote(draft, selectedFiles),
      }),
      [draft, selectedFiles, persistNewNote],
    );

    return (
      <div
        className={cn("grid gap-2 rounded-lg border border-border/50 bg-muted/15 p-3", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {!askConfirmProp ? <internalConfirm.ConfirmDialogHost /> : null}

        {showIngestSummary ? (
          <div className="space-y-1.5 rounded-md border border-dashed border-sky-500/25 bg-sky-500/5 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sky-800/80 dark:text-sky-200/80">
              {formatIngestSummaryLabel()}
            </p>
            <p className="text-sm whitespace-pre-wrap text-foreground">{ingestSummary}</p>
            <p className="text-[10px] text-muted-foreground">
              Actualizado por WhatsApp/n8n. No reemplaza tus notas de seguimiento.
            </p>
          </div>
        ) : null}

        <Label htmlFor={`lead-note-draft-${leadId}`}>Notas de seguimiento (vendedor)</Label>

        <div className="space-y-2">
          <Textarea
            id={`lead-note-draft-${leadId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe el seguimiento de esta conversación…"
            rows={3}
            disabled={isSaving}
          />
          <p className="text-[10px] text-muted-foreground leading-snug">
            Cada guardado agrega una nota de vendedor nueva. Queda respaldada automáticamente y no la
            pisa el chatbot.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePickFiles}
            disabled={isSaving}
          />

          {previews.length ? (
            <div className="flex flex-wrap gap-2">
              {previews.map((preview, index) => (
                <div
                  key={preview.url}
                  className="relative h-16 w-16 overflow-hidden rounded-md border border-border/50 bg-muted"
                >
                  <img
                    src={preview.url}
                    alt={preview.file.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeSelectedFile(index)}
                    disabled={isSaving}
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground shadow hover:bg-background"
                    aria-label={`Quitar ${preview.file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
            >
              <ImagePlus className="mr-1 h-4 w-4" aria-hidden />
              Adjuntar imágenes
            </Button>
            {draft.trim() || selectedFiles.length ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void handleSaveNote()}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar nota
              </Button>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/40 bg-background/60 p-2",
            (notes.length > 0) && "min-h-[3rem]",
          )}
        >
          {isLoading ? (
            <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando notas…
            </p>
          ) : null}

          {isError ? (
            <div className="space-y-2 px-2 py-2">
              <p className="text-sm text-destructive">Error al cargar las notas guardadas.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          ) : null}

          {!isLoading && !isError && notes.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Aún no hay notas de seguimiento.</p>
          ) : null}

          {notesNewestFirst.map((note) => {
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
                    <Button type="button" size="sm" onClick={() => void handleUpdateNote()} disabled={isSaving || !editDraft.trim()}>
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Guardar edición
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={isSaving} onClick={cancelEdit}>
                      Cancelar
                    </Button>
                    {canDeleteNotes ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isSaving || deletingNoteId === note.id}
                        onClick={() => void handleDeleteNote(note.id)}
                      >
                        {deletingNoteId === note.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                            Eliminar
                          </>
                        )}
                      </Button>
                    ) : null}
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
                className="group relative rounded-md border border-border/45 bg-background px-3 py-2 pr-[4.25rem] shadow-sm"
              >
                <div className="absolute right-1 top-1 flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => startEdit(note.id, note.body)}
                    disabled={isSaving || deletingNoteId !== null}
                    aria-label="Editar nota"
                    title="Editar nota"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {canDeleteNotes ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive opacity-100 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => void handleDeleteNote(note.id)}
                      disabled={isSaving || deletingNoteId === note.id}
                      aria-label="Eliminar nota"
                      title="Eliminar nota"
                    >
                      {deletingNoteId === note.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  ) : null}
                </div>
                {note.body ? (
                  <p className="text-sm whitespace-pre-wrap text-foreground">{note.body}</p>
                ) : null}
                <LeadNoteAttachments attachments={note.attachmentsResolved} />
                <NoteTimestamps
                  createdAt={note.created_at}
                  updatedAt={note.updated_at}
                  authorName={authorName}
                />
              </article>
            );
          })}
        </div>
      </div>
    );
  },
);
