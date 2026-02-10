import { useEffect, useState } from "react";

interface DashboardLoaderProps {
  message?: string;
  barLabel?: string;
}

export default function DashboardLoader({ message = "Cargando...", barLabel }: DashboardLoaderProps) {
  const label = barLabel ?? (message.startsWith("Cerrando") ? "Cerrando sesión" : "Cargando");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        return prev + Math.random() * 8 + 4;
      });
    }, 180);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Marca SKALEMOTORS - mismo estilo y efectos que en TopBar */}
        <div className="text-center">
          <span className="skale-logo inline-block text-2xl sm:text-3xl animate-pulse cursor-default hover:opacity-80 transition-opacity">
            SKALEMOTORS
          </span>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>

        {/* Barra de progreso con porcentaje */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{label}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
