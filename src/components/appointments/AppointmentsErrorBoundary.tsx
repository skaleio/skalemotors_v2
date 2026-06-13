import { Button } from "@/components/ui/button";
import { captureAppError } from "@/lib/observability";
import { CalendarDays, RefreshCw } from "lucide-react";
import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

/** Evita pantalla negra global si falla el calendario de Citas. */
export class AppointmentsErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AppointmentsErrorBoundary]", error, errorInfo);
    captureAppError(error, { componentStack: errorInfo.componentStack, scope: "appointments" });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="rounded-2xl bg-muted p-4">
            <CalendarDays className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">No pudimos cargar tu calendario</h1>
            <p className="text-sm text-muted-foreground">
              Hubo un error al mostrar Citas. Recarga la página; si persiste, avisa al administrador.
            </p>
          </div>
          <Button type="button" onClick={this.handleReload} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Recargar Citas
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
