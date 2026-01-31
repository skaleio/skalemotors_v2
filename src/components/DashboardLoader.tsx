import { useEffect, useState } from "react";

interface DashboardLoaderProps {
  message?: string;
}

export default function DashboardLoader({ message = "Cargando estadísticas" }: DashboardLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progreso suave y continuo
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + 10;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-200px)]">
      <div className="w-full max-w-sm space-y-4 px-4">
        {/* Texto */}
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">{message}</p>
        </div>

        {/* Barra de progreso simple */}
        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
