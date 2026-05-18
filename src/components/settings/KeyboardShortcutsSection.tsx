import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Keyboard, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useShortcutsPreferences } from "@/contexts/ShortcutsPreferencesContext";
import { ShortcutsCustomizerModal } from "@/components/ShortcutsCustomizerModal";

type ToggleFeedback = { type: "success" | "error"; message: string };

export function KeyboardShortcutsSection() {
  const { shortcutsEnabled, setShortcutsEnabled, isLoading } = useShortcutsPreferences();
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [feedback, setFeedback] = useState<ToggleFeedback | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function handleToggle(checked: boolean) {
    setToggling(true);
    setFeedback(null);
    try {
      await setShortcutsEnabled(checked);
      setFeedback({
        type: "success",
        message: checked
          ? "Atajos activados. Ctrl+K y tus combinaciones personalizadas vuelven a funcionar."
          : "Atajos desactivados. Ctrl+C, Ctrl+V y el portapapeles funcionan como en el navegador.",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudo guardar la preferencia. Intentá de nuevo en unos segundos.",
      });
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atajos de teclado
          </CardTitle>
          <CardDescription>
            Los atajos globales pueden interferir con copiar y pegar. Desactívalos cuando necesites usar el
            portapapeles con normalidad en la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {feedback && <ToggleFeedbackAlert feedback={feedback} />}

          <ShortcutsToggleRow
            shortcutsEnabled={shortcutsEnabled}
            isLoading={isLoading}
            toggling={toggling}
            onToggle={handleToggle}
          />
          <ShortcutsCustomizeRow
            disabled={isLoading}
            onOpen={() => setShowCustomizer(true)}
          />
        </CardContent>
      </Card>

      <ShortcutsCustomizerModal open={showCustomizer} onOpenChange={setShowCustomizer} />
    </>
  );
}

function ShortcutsToggleRow({
  shortcutsEnabled,
  isLoading,
  toggling,
  onToggle,
}: {
  shortcutsEnabled: boolean;
  isLoading: boolean;
  toggling: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <ShortcutsToggleRowContainer>
      <ShortcutsToggleCopy shortcutsEnabled={shortcutsEnabled} />
      <ShortcutsToggleSwitch
        shortcutsEnabled={shortcutsEnabled}
        isLoading={isLoading}
        toggling={toggling}
        onToggle={onToggle}
      />
    </ShortcutsToggleRowContainer>
  );
}

function ShortcutsToggleRowContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4">
      {children}
    </div>
  );
}

function ShortcutsToggleCopy({ shortcutsEnabled }: { shortcutsEnabled: boolean }) {
  return (
    <div className="space-y-1">
      <Label htmlFor="shortcuts-enabled" className="text-base">
        Usar atajos de teclado en la app
      </Label>
      <p className="text-sm text-muted-foreground">
        {shortcutsEnabled
          ? "Activo: Ctrl+K abre acciones rápidas y los atajos personalizados navegan por el sistema."
          : "Desactivado: Ctrl+C, Ctrl+V y el resto funcionan como en el navegador."}
      </p>
    </div>
  );
}

function ShortcutsToggleSwitch({
  shortcutsEnabled,
  isLoading,
  toggling,
  onToggle,
}: {
  shortcutsEnabled: boolean;
  isLoading: boolean;
  toggling: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {(isLoading || toggling) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <Switch
        id="shortcuts-enabled"
        checked={shortcutsEnabled}
        onCheckedChange={onToggle}
        disabled={isLoading || toggling}
      />
    </div>
  );
}

function ToggleFeedbackAlert({ feedback }: { feedback: ToggleFeedback }) {
  const isSuccess = feedback.type === "success";

  if (isSuccess) {
    return (
      <Alert
        aria-live="polite"
        className="border-green-500/50 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-950/40 dark:text-green-100"
      >
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-green-800 dark:text-green-200">{feedback.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" aria-live="assertive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{feedback.message}</AlertDescription>
    </Alert>
  );
}

function ShortcutsCustomizeRow({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4">
      <div>
        <p className="font-medium text-sm">Combinaciones personalizadas</p>
        <p className="text-sm text-muted-foreground">
          Cambiá qué tecla abre cada módulo sin chocar con copiar o pegar.
        </p>
      </div>
      <Button type="button" variant="outline" onClick={onOpen} disabled={disabled}>
        Personalizar atajos
      </Button>
    </div>
  );
}
