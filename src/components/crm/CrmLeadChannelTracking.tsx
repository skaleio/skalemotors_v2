import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LeadMetricBar } from "@/components/leads/LeadMetricBar";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirmDialog, type ConfirmOptions } from "@/hooks/useConfirmDialog";
import {
  FOLLOW_UP_CHANNEL_FIELD,
  FOLLOW_UP_CHANNEL_LABEL,
  validateChannelNote,
  type FollowUpChannel,
} from "@/lib/leadFollowUpNote";
import { selectValidAttachments } from "@/lib/leadNoteAttachments";
import { leadNoteService } from "@/lib/services/leadNotes";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, MessageCircle, Pencil, Phone, Trash2, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { LeadNoteAttachments } from "./LeadNoteAttachments";

function formatNoteDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export type CrmLeadChannelTrackingHandle = {
  hasPendingDraft: () => boolean;
  /** Valida y guarda el borrador pendiente. Devuelve false si la validación o el guardado fallan. */
  savePendingDraft: () => Promise<boolean>;
};

type CrmLeadChannelTrackingProps = {
  leadId: string;
  channel: FollowUpChannel;
  tenantId: string | null | undefined;
  branchId?: string | null;
  /** Valor del contador del canal (calls_made / whatsapp_attempts). */
  counterValue: number;
  /** Modo edición del diálogo: el contador solo actualiza estado local y persiste al guardar. */
  localOnly?: boolean;
  onCounterChange?: (next: number) => void;
  askConfirm?: (opts: ConfirmOptions) => Promise<boolean>;
  /** Número de paso (1 = Llamadas, 2 = WhatsApp). */
  step?: number;
  /** Recordatorio no bloqueante mostrado arriba del composer. */
  reminder?: string;
};

export const CrmLeadChannelTracking = forwardRef<
  CrmLeadChannelTrackingHandle,
  CrmLeadChannelTrackingProps
>(function CrmLeadChannelTracking(
  {
    leadId,
    channel,
    tenantId,
    branchId,
    counterValue,
    localOnly = false,
    onCounterChange,
    askConfirm: askConfirmProp,
    step,
    reminder,
  },
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

  const handlePickFiles = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!list.length) return;
    setSelectedFiles((prev) => {
      const { accepted, rejected } = selectValidAttachments({ files: list, existingCount: prev.length });
      if (rejected.length) toast.error(rejected[0].reason);
      return accepted.length ? [...prev, ...accepted] : prev;
    });
  }, []);

  const removeSelectedFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const channelLabel = FOLLOW_UP_CHANNEL_LABEL[channel];
  const ChannelIcon = channel === "llamada" ? Phone : MessageCircle;
  const actionVerb = channel === "llamada" ? "llamada" : "WhatsApp";
  const channelNoteLabel = channel === "llamada" ? "Llamada" : "WhatsApp";

  const canDeleteNotes =
    user?.role === "admin"
    || user?.role === "gerente"
    || user?.role === "jefe_jefe"
    || user?.role === "jefe_sucursal";

  const queryKey = ["lead-notes", leadId, channel] as const;

  const { data: notes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => leadNoteService.listByLead(leadId, channel),
    enabled: !!leadId,
    retry: 2,
  });

  const notesNewestFirst = useMemo(() => [...notes].reverse(), [notes]);

  useEffect(() => {
    setDraft("");
    setSelectedFiles([]);
    setEditingNoteId(null);
    setEditDraft("");
  }, [leadId, channel]);

  const errorToastShownRef = useRef(false);
  useEffect(() => {
    if (!isError) {
      errorToastShownRef.current = false;
      return;
    }
    if (errorToastShownRef.current) return;
    errorToastShownRef.current = true;
    console.error("[CrmLeadChannelTracking] load", { channel, error });
    toast.error(`No se pudieron cargar las notas de ${channelLabel.toLowerCase()}.`);
  }, [isError, error, channel, channelLabel]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["seller-engagement"] });
  }, [queryClient, queryKey]);

  const cancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditDraft("");
  }, []);

  const createNote = useCallback(
    async (body: string, files: File[]): Promise<boolean> => {
      if (!tenantId) {
        toast.error("No se pudo identificar el tenant para guardar la nota.");
        return false;
      }
      // La fecha y hora se capturan automáticamente al registrar la nota.
      const nowIso = new Date().toISOString();

      setIsSaving(true);
      try {
        const created = await leadNoteService.create({
          leadId,
          body: body.trim(),
          tenantId,
          branchId: branchId ?? user?.branch_id ?? null,
          createdBy: user?.id ?? null,
          channel,
          nextActionAt: nowIso,
          files,
        });
        const cached = queryClient.getQueryData<typeof notes>(queryKey) ?? notes;
        queryClient.setQueryData(queryKey, [...cached, created]);
        setDraft("");
        setSelectedFiles([]);
        cancelEdit();
        await queryClient.refetchQueries({ queryKey });
        invalidate();
        return true;
      } catch (err) {
        console.error("[CrmLeadChannelTracking] create", err);
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la nota.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [tenantId, leadId, branchId, channel, user?.branch_id, user?.id, queryClient, queryKey, notes, invalidate, cancelEdit],
  );

  /** Registro explícito (botón): exige nota real con contexto. */
  const persistNewNote = useCallback(
    async (body: string): Promise<boolean> => {
      const validation = validateChannelNote({ body, nextActionAt: new Date().toISOString() });
      if (!validation.ok) {
        toast.error(validation.errors.join(" "));
        return false;
      }
      return createNote(body, selectedFiles);
    },
    [createNote, selectedFiles],
  );

  const handleSaveNote = useCallback(async () => {
    const ok = await persistNewNote(draft);
    if (ok) toast.success(`Seguimiento de ${actionVerb} registrado`);
  }, [draft, persistNewNote, actionVerb]);

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
        (current ?? []).map((n) => (n.id === updated.id ? { ...n, ...updated } : n)),
      );
      cancelEdit();
      invalidate();
      toast.success("Nota actualizada");
    } catch (err) {
      console.error("[CrmLeadChannelTracking] update", err);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la nota.");
    } finally {
      setIsSaving(false);
    }
  }, [editingNoteId, editDraft, cancelEdit, invalidate, queryClient, queryKey, notes]);

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      const ok = await askConfirm({
        title: "¿Eliminar esta nota?",
        description: "Se quitará de la vista activa, pero quedará respaldada en el historial del lead.",
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
        console.error("[CrmLeadChannelTracking] delete", err);
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
      // Guardado al mover/guardar el lead: best-effort, NO bloquea el movimiento
      // ni exige nota válida (la validación vive solo en el botón "Registrar").
      savePendingDraft: async () => {
        if (!draft.trim() && !selectedFiles.length) return true;
        await createNote(draft, selectedFiles);
        return true;
      },
    }),
    [draft, selectedFiles, createNote],
  );

  return (
    <div
      className="grid gap-2.5 rounded-lg border border-border/50 bg-muted/15 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      {!askConfirmProp ? <internalConfirm.ConfirmDialogHost /> : null}

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {step ? (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
              {step}
            </span>
          ) : null}
          <ChannelIcon className="h-4 w-4" aria-hidden />
          {channelLabel}
        </p>
        <LeadMetricBar
          leadId={leadId}
          field={FOLLOW_UP_CHANNEL_FIELD[channel]}
          value={counterValue}
          showLabel={false}
          bordered
          size="sm"
          localOnly={localOnly}
          onChange={onCounterChange}
        />
      </div>

      {reminder ? (
        <p className="flex items-center gap-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {reminder}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`channel-note-${channel}-${leadId}`}>
          Nota de {actionVerb} (qué ofreciste, qué conversaron, qué quedó pendiente)
        </Label>
        <Textarea
          id={`channel-note-${channel}-${leadId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Describe la ${actionVerb} con el cliente…`}
          rows={3}
          disabled={isSaving}
        />
        <p className="text-[10px] text-muted-foreground">
          La fecha y hora se guardan automáticamente al registrar la nota.
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
                <img src={preview.url} alt={preview.file.name} className="h-full w-full object-cover" />
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
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void handleSaveNote()}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Registrar {actionVerb}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/40 bg-background/60 p-2",
          notes.length > 0 && "min-h-[3rem]",
        )}
      >
        {isLoading ? (
          <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Cargando…
          </p>
        ) : null}

        {isError ? (
          <div className="space-y-2 px-2 py-2">
            <p className="text-sm text-destructive">Error al cargar las notas.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : null}

        {!isLoading && !isError && notes.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            Aún no hay seguimiento de {actionVerb}.
          </p>
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
                </div>
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
              <span
                className={cn(
                  "mb-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  channel === "whatsapp"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-blue-500/10 text-blue-700 dark:text-blue-300",
                )}
              >
                <ChannelIcon className="h-3 w-3" aria-hidden />
                {channelNoteLabel}
              </span>
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
    </div>
  );
});
