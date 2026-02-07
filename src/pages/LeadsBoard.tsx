import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLeads } from "@/hooks/useLeads";
import type { Database } from "@/lib/types/database";
import { Plus } from "lucide-react";
import { memo, useMemo } from "react";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

function formatStateUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const LeadCard = memo(({ lead }: { lead: Lead }) => {
  const hasAiState = lead.state != null && lead.state !== "";

  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <div className="font-medium">
        {lead.full_name || "Sin nombre"}
      </div>
      <div className="text-muted-foreground">
        {lead.phone || "Sin telefono"}
      </div>
      {hasAiState && (
        <div className="mt-2 rounded border border-dashed border-muted-foreground/30 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
          <div className="font-medium text-foreground/90">
            Estado IA: {lead.state}
            {lead.state_confidence != null && !Number.isNaN(Number(lead.state_confidence)) && (
              <span> ({Math.round(Number(lead.state_confidence) * 100)}%)</span>
            )}
          </div>
          {lead.state_reason && (
            <div className="mt-0.5 truncate" title={lead.state_reason}>{lead.state_reason}</div>
          )}
          {lead.state_updated_at && (
            <div className="mt-0.5 text-[10px] opacity-80">{formatStateUpdatedAt(lead.state_updated_at)}</div>
          )}
        </div>
      )}
    </div>
  );
});

export default function LeadsBoard() {
  const { user } = useAuth();
  const { leads, loading } = useLeads({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user,
  });

  const stages = useMemo(
    () => [
      { key: "nuevo", label: "Nuevo", statuses: ["nuevo"] },
      { key: "contactado", label: "Contactado", statuses: ["contactado"] },
      { key: "interesado", label: "Interesado", statuses: ["interesado"] },
      { key: "cerrado", label: "Cerrado", statuses: ["vendido", "perdido"] },
    ],
    [],
  );

  const leadsByStage = useMemo(() => {
    return stages.map((stage) => ({
      ...stage,
      leads: leads.filter((lead) => stage.statuses.includes(lead.status)),
    }));
  }, [leads, stages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tablero de Leads</h1>
          <p className="text-muted-foreground mt-2">
            Visualiza y gestiona tus leads por etapa
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Lead
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {leadsByStage.map((stage) => (
          <Card key={stage.key}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-sm">{stage.label}</span>
                <Badge variant="secondary">{stage.leads.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 min-h-[200px]">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Cargando leads...
                  </p>
                ) : stage.leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay leads en esta etapa
                  </p>
                ) : (
                  stage.leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
