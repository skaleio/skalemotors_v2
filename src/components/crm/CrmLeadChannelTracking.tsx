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
import { leadNoteService } from "@/lib/services/leadNotes";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, MessageCircle, Pencil, Phone, Trash2 } from "lucide-react";
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
  /** Bloquea el registro hasta completar el paso previo. */
  locked?: boolean;
  /** Mensaje mostrado cuando está bloqueado. */
  lockedHint?: string;
  /** Reporta cuántas notas registradas tiene el canal (para encadenar los pasos). */
  onNotesCountChange?: (count: number) => void;
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
    locked = false,
    lockedHint,
    onNotesCountChange,
  },
  ref,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const internalConfirm = useConfirmDialog();
  const askConfirm = askConfirmProp ?? internalConfirm.confirm;

  const [draft, setDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const channelLabel = FOLLOW_UP_CHANNEL_LABEL[channel];
  const ChannelIcon = channel === "llamada" ? Phone : MessageCircle;
  const actionVerb = channel === "llamada" ? "llamada" : "WhatsApp";

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
    onNotesCountChange?.(notes.length);
  }, [notes.length, onNotesCountChange]);

  useEffect(() => {
    setDraft("");
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

  const persistNewNote = useCallback(
    async (body: string): Promise<boolean> => {
      // La fecha y hora se capturan automáticamente al registrar la nota.
      const nowIso = new Date().toISOString();
      const validation = validateChannelNote({ body, nextActionAt: nowIso });
      if (!validation.ok) {
        toast.error(validation.errors.join(" "));
        return false;
      }
      if (!tenantId) {
        toast.error("No se pudo identificar el tenant para guardar la nota.");
        return false;
      }

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
        });
        const cached = queryClient.getQueryData<typeof notes>(queryKey) ?? notes;
        queryClient.setQueryData(queryKey, [...cached, created]);
        setDraft("");
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
      hasPendingDraft: () => !locked && draft.trim().length > 0,
      savePendingDraft: async () => {
        if (locked || !draft.trim()) return true;
        return persistNewNote(draft);
      },
    }),
    [draft, locked, persistNewNote],
  );

  return (
    <div
      className={cn(
        "grid gap-2.5 rounded-lg border border-border/50 bg-muted/15 p-3",
        locked && "border-dashed",
      )}
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
        <div className={cn(locked && "pointer-events-none opacity-40")}>
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
      </div>

      {locked ? (
        <p className="flex items-center gap-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {lockedHint ?? "Completa el paso anterior para habilitar este canal."}
        </p>
      ) : null}

      <div className={cn("space-y-2", locked && "pointer-events-none opacity-50")}>
        <Label htmlFor={`channel-note-${channel}-${leadId}`}>
          Nota de {actionVerb} (qué ofreciste, qué conversaron, qué quedó pendiente)
        </Label>
        <Textarea
          id={`channel-note-${channel}-${leadId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Describe la ${actionVerb} con el cliente…`}
          rows={3}
          disabled={isSaving || locked}
        />
        <p className="text-[10px] text-muted-foreground">
          La fecha y hora se guardan automáticamente al registrar la nota.
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void handleSaveNote()}
          disabled={isSaving || locked}
        >
          {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Registrar {actionVerb}
        </Button>
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
    </div>
  );
});
