import { ClipboardList } from "lucide-react";

import { DailySalesReportPanel } from "@/components/tasks/DailySalesReportSupervision";

export default function PendingTasks() {
  return (
    <div className="w-full max-w-none space-y-6 pb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-7 w-7" />
          Informe diario
        </h1>
        <p className="text-muted-foreground mt-1">
          Registra la actividad del día: llamados, créditos, redes y publicaciones en plataformas.
        </p>
      </div>

      <DailySalesReportPanel />
    </div>
  );
}
