import { Loader2 } from "lucide-react";

interface DashboardLoaderProps {
  message?: string;
  barLabel?: string;
}

export default function DashboardLoader({ message = "Cargando..." }: DashboardLoaderProps) {
  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center space-y-6">
        <h1 className="skale-logo inline-block text-3xl sm:text-4xl text-primary animate-pulse">
          SKALEMOTORS
        </h1>
        
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium tracking-wide">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
