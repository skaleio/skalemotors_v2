import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/contexts/ThemeContext";
import { useShortcutsPreferences } from "@/contexts/ShortcutsPreferencesContext";
import {
  DEFAULT_SHORTCUTS,
  formatKeyCombo,
  SHORTCUT_ACTIONS,
  type ShortcutActionDef,
} from "@/lib/shortcuts-defaults";
import type { ShortcutsMap } from "@/lib/services/shortcutsPreferences";
import { toast } from "sonner";

interface ShortcutsCustomizerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function shortcutsEqual(a: ShortcutsMap, b: ShortcutsMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? DEFAULT_SHORTCUTS[k]) !== (b[k] ?? DEFAULT_SHORTCUTS[k])) return false;
  }
  return true;
}

export function ShortcutsCustomizerModal({ open, onOpenChange }: ShortcutsCustomizerModalProps) {
  const { theme } = useTheme();
  const { shortcuts, saveShortcutsMap, isLoading } = useShortcutsPreferences();
  const [draftShortcuts, setDraftShortcuts] = useState<ShortcutsMap>(() => ({ ...shortcuts }));
  const [listeningId, setListeningId] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sincronizar borrador cuando se abre el modal o cuando se guardan cambios desde fuera
  useEffect(() => {
    if (open) setDraftShortcuts({ ...shortcuts });
  }, [open, shortcuts]);

  const hasUnsavedChanges = useMemo(
    () => !shortcutsEqual(draftShortcuts, shortcuts),
    [draftShortcuts, shortcuts]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!listeningId) return;
      e.preventDefault();
      e.stopPropagation();
      const isCtrl = e.ctrlKey;
      const isMeta = e.metaKey;
      if (!isCtrl && !isMeta) return;
      const key = e.key.toLowerCase();
      if (key === "control" || key === "meta") return;
      const combo = formatKeyCombo(isCtrl, isMeta, key);
      setDraftShortcuts((prev) => ({ ...prev, [listeningId]: combo }));
      setListeningId(null);
    },
    [listeningId]
  );

  useEffect(() => {
    if (!listeningId) return;
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [listeningId, handleKeyDown]);

  const grouped = SHORTCUT_ACTIONS.reduce<Record<string, ShortcutActionDef[]>>((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {});

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveShortcutsMap(draftShortcuts);
      toast.success("Atajos guardados correctamente");
    } catch {
      toast.error("No se pudieron guardar los atajos. Inténtelo nuevamente.");
    } finally {
      setSaving(false);
    }
  }, [draftShortcuts, saveShortcutsMap]);

  const handleReset = useCallback(async () => {
    setDraftShortcuts({ ...DEFAULT_SHORTCUTS });
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next === false && hasUnsavedChanges) {
        setShowDiscardConfirm(true);
        return;
      }
      onOpenChange(next);
    },
    [hasUnsavedChanges, onOpenChange]
  );

  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`max-w-2xl min-h-[75vh] max-h-[90vh] border-0 shadow-2xl p-0 overflow-hidden flex flex-col rounded-2xl ${
          theme === "dark" ? "bg-slate-800/95 border-slate-700" : "bg-white/95"
        }`}
      >
        <div
          className={`px-4 pt-4 pb-3 flex-shrink-0 border-b ${
            theme === "dark" ? "border-slate-600/50" : "border-gray-100/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md shrink-0">
              <Keyboard className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className={`text-lg font-semibold leading-tight ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                Personalizar atajos
              </DialogTitle>
              <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                Haz clic en un atajo y pulsa la nueva combinación (Ctrl + tecla)
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
              className="shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Restaurar
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-[50vh] overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className={`text-sm ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
              Cargando…
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([category, actions]) => (
                <div key={category} className="space-y-2">
                  <h3
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      theme === "dark" ? "text-slate-300" : "text-gray-700"
                    }`}
                  >
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {actions.map((action) => {
                      const combo = draftShortcuts[action.id] ?? DEFAULT_SHORTCUTS[action.id];
                      const isListening = listeningId === action.id;
                      return (
                        <div
                          key={action.id}
                          className={`flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg ${
                            theme === "dark" ? "bg-slate-700/50" : "bg-gray-50/80"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className={`font-medium text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                              {action.label}
                            </div>
                            <div className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
                              {action.description}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant={isListening ? "default" : "outline"}
                            size="sm"
                            onClick={() => setListeningId(isListening ? null : action.id)}
                            className="shrink-0 font-mono"
                          >
                            {isListening ? (
                              "Pulsa Ctrl + tecla…"
                            ) : (
                              <>
                                <kbd
                                  className={`px-1.5 py-0.5 border rounded text-xs ${
                                    theme === "dark"
                                      ? "bg-slate-600 border-slate-500 text-slate-300"
                                      : "bg-white border-gray-200"
                                  }`}
                                >
                                  {combo}
                                </kbd>
                                <span className="ml-2">Cambiar</span>
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={`px-4 py-3 border-t flex-shrink-0 flex items-center justify-between gap-3 ${
            theme === "dark" ? "border-slate-600/50 bg-slate-700/30" : "border-gray-100/50 bg-gray-50/30"
          }`}
        >
          <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-gray-500"}`}>
            Guarda los cambios para que se apliquen en toda la aplicación.
          </p>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving}
            className="shrink-0"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
          <AlertDialogDescription>
            Tienes cambios sin guardar en los atajos. Si sales ahora, se perderán. ¿Quieres descartarlos?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
