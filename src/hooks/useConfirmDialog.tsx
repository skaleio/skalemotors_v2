import { useCallback, useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

// Reemplazo accesible de window.confirm(). Devuelve una promesa true/false.
// Usar siempre en acciones destructivas: el confirm nativo rompe en mobile,
// no respeta tema y no es testeable.
export function useConfirmDialog() {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ opts, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    if (state) {
      state.resolve(result);
      setState(null);
    }
  };

  // Si el componente padre desmonta con el dialog abierto (navegación
  // rápida, redirect por timeout de sesión), resolver con `false` para no
  // dejar la promise colgada en memoria.
  useEffect(() => {
    return () => {
      setState((prev) => {
        if (prev) prev.resolve(false);
        return null;
      });
    };
  }, []);

  const ConfirmDialog = state ? (
    <AlertDialog open onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.opts.title}</AlertDialogTitle>
          {state.opts.description && (
            <AlertDialogDescription>{state.opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {state.opts.cancelLabel ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={cn(
              state.opts.destructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {state.opts.confirmLabel ?? "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { confirm, ConfirmDialog };
}
