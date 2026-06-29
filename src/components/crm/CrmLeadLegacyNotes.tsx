import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { selectValidAttachments, type LeadNoteAttachment } from "@/lib/leadNoteAttachments";
import { leadNoteService, type LeadNoteWithAuthor } from "@/lib/services/leadNotes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ImagePlus, Loader2, Pencil, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LeadNoteAttachments } from "./LeadNoteAttachments";

function formatNoteDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Quita la signed URL para quedarnos solo con la metadata persistible del adjunto. */
function toStoredAttachment(att: { path: string; name: string; size: number; mime: string; width?: number; height?: number }): LeadNoteAttachment {
  return { path: att.path, name: att.name, size: att.size, mime: att.mime, width: att.width, height: att.height };
}

/**
 * Notas de seguimiento previas al modelo por canal (channel IS NULL).
 * Solo el admin puede editarlas (texto + agregar/quitar imágenes); el resto las ve en solo lectura.
 */
export function CrmLeadLegacyNotes({ leadId }: { leadId: string }) {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const queryClient = useQueryClient();
  const queryKey = ["lead-notes", leadId, "legacy"] as const;

  const [open, setOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [keepAttachments, setKeepAttachments] = useState<LeadNoteAttachment[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => leadNoteService.listLegacyByLead(leadId),
    enabled: !!leadId,
  });

  const newPreviews = useMemo(
    () => newFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newFiles],
  );
  useEffect(() => {
    return () => newPreviews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [newPreviews]);

  const startEdit = (note: LeadNoteWithAuthor) => {
    setEditingId(note.id);
    setEditBody(note.body ?? "");
    setKeepAttachments((note.attachmentsResolved ?? []).map(toStoredAttachment));
    setRemovedPaths([]);
    setNewFiles([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBody("");
    setKeepAttachments([]);
    setRemovedPaths([]);
    setNewFiles([]);
  };

  const removeExisting = (path: string) => {
    setKeepAttachments((prev) => prev.filter((a) => a.path !== path));
    setRemovedPaths((prev) => [...prev, path]);
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!list.length) return;
    setNewFiles((prev) => {
      const existingCount = keepAttachments.length + prev.length;
      const { accepted, rejected } = selectValidAttachments({ files: list, existingCount });
      if (rejected.length) toast.error(rejected[0].reason);
      return accepted.length ? [...prev, ...accepted] : prev;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (note: LeadNoteWithAuthor) => {
      if (!note.tenant_id) throw new Error("No se pudo identificar el tenant de la nota.");
      return leadNoteService.updateWithAttachments({
        noteId: note.id,
        body: editBody,
        tenantId: note.tenant_id,
        leadId,
        keep: keepAttachments,
        newFiles,
        removedPaths,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      cancelEdit();
      toast.success("Nota actualizada");
    },
    onError: (err) => {
      console.error("[CrmLeadLegacyNotes] update", err);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la nota.");
    },
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
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md border border-border/40 bg-background/60 p-2">
            {[...notes].reverse().map((note) => {
              const authorName = note.author?.full_name?.trim() || note.author?.email?.trim();
              const isEditing = editingId === note.id;
              const isSaving = saveMutation.isPending;

              if (isEditing) {
                return (
                  <article
                    key={note.id}
                    className="space-y-2 rounded-md border border-primary/40 bg-background px-3 py-2 shadow-sm"
                  >
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      placeholder="Edita la nota…"
                      disabled={isSaving}
                    />
                    {(keepAttachments.length > 0 || newPreviews.length > 0) ? (
                      <div className="flex flex-wrap gap-2">
                        {keepAttachments.map((att) => {
                          const resolved = (note.attachmentsResolved ?? []).find((a) => a.path === att.path);
                          return (
                            <div
                              key={att.path}
                              className="relative h-16 w-16 overflow-hidden rounded-md border border-border/50 bg-muted"
                            >
                              {resolved ? (
                                <img src={resolved.url} alt={att.name} className="h-full w-full object-cover" />
                              ) : null}
                              <button
                                type="button"
                                onClick={() => removeExisting(att.path)}
                                disabled={isSaving}
                                className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-foreground shadow hover:bg-background"
                                aria-label={`Quitar ${att.name}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                        {newPreviews.map((preview, index) => (
                          <div
                            key={preview.url}
                            className="relative h-16 w-16 overflow-hidden rounded-md border border-primary/50 bg-muted"
                          >
                            <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeNewFile(index)}
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePickFiles}
                      disabled={isSaving}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSaving}
                      >
                        <ImagePlus className="mr-1 h-4 w-4" aria-hidden />
                        Agregar imágenes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => saveMutation.mutate(note)}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
                        Guardar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                        Cancelar
                      </Button>
                    </div>
                  </article>
                );
              }

              return (
                <article
                  key={note.id}
                  className="rounded-md border border-border/45 bg-background px-3 py-2 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap text-foreground">{note.body}</p>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => startEdit(note)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Editar nota"
                        aria-label="Editar nota"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  <LeadNoteAttachments attachments={note.attachmentsResolved} />
                  <div className="mt-1 space-y-0.5 text-[11px] leading-snug text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground/55">Registrada:</span>{" "}
                      {formatNoteDate(note.created_at)}
                      {note.updated_at ? " · editada" : ""}
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
