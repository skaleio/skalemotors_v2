import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLeads } from "@/hooks/useLeads";
import type { Database } from "@/lib/types/database";
import { memo, useEffect, useMemo } from "react";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const CONSIGNACION_TAG_PREFIX = "consignacion:";

const labelStyles: Record<string, { dot: string; text: string }> = {
  sin_etiqueta: { dot: "bg-slate-300", text: "text-slate-600" },
  Urgente: { dot: "bg-red-500", text: "text-red-600" },
  Prioritario: { dot: "bg-orange-500", text: "text-orange-600" },
  "Documentos pendientes": { dot: "bg-amber-500", text: "text-amber-600" },
  "Listo para publicar": { dot: "bg-emerald-500", text: "text-emerald-600" },
  Publicado: { dot: "bg-purple-500", text: "text-purple-600" },
  "Seguimiento semanal": { dot: "bg-blue-500", text: "text-blue-600" },
};

const stageStyles: Record<
  "nuevo" | "contactado" | "interesado" | "negociando",
  { border: string; badge: string; dot?: string }
> = {
  nuevo: { border: "", badge: "" },
  contactado: { border: "border-blue-500", badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  interesado: { border: "border-purple-500", badge: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  negociando: { border: "border-orange-500", badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
};

const normalizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return [] as string[];
  return tags.filter((tag) => typeof tag === "string") as string[];
};

const getConsignacionLabel = (tags: unknown): string | null => {
  const match = normalizeTags(tags).find((tag) =>
    tag.startsWith(CONSIGNACION_TAG_PREFIX),
  );
  if (!match) return null;
  const label = match.replace(CONSIGNACION_TAG_PREFIX, "").trim();
  if (!label || label === "sin_etiqueta") return null;
  return label;
};

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
  const label = getConsignacionLabel(lead.tags);
  const styles = label ? (labelStyles[label] || labelStyles.sin_etiqueta) : null;
  const hasAiState = lead.state != null && lead.state !== "";

  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <div className="font-medium">
        {lead.full_name || "Sin nombre"}
      </div>
      <div className="text-muted-foreground">
        {lead.phone || "Sin telefono"}
      </div>
      {label && styles && (
        <div className="mt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
            <span className={`${styles.text} font-medium`}>{label}</span>
          </span>
        </div>
      )}
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

export default function CRM() {
  const { user } = useAuth();
  const { leads, loading, refetch } = useLeads({
    branchId: user?.branch_id ?? undefined,
    enabled: !!user?.branch_id,
  });

  useEffect(() => {
    if (!user?.branch_id) return;
    refetch();
  }, [user?.branch_id, refetch]);

  const stages = useMemo(
    () => [
      { key: "nuevo", label: "Nuevo", statuses: ["nuevo"] },
      { key: "contactado", label: "Contactado", statuses: ["contactado"] },
      { key: "interesado", label: "Interesado", statuses: ["interesado"] },
      { key: "negociando", label: "Negociando", statuses: ["negociando"] },
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
          <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground mt-2">
            Gestión de clientes y relaciones
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {leadsByStage.map((stage) => {
          const style = stageStyles[stage.key as keyof typeof stageStyles];

          return (
          <Card key={stage.key} className={`border-t-4 ${style?.border || ""}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  {style?.dot && <span className={`h-2 w-2 rounded-full ${style.dot}`} />}
                  {stage.label}
                </span>
                <Badge className={style?.badge || ""} variant="secondary">
                  {stage.leads.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 min-h-[180px]">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Cargando leads...
                  </p>
                ) : stage.leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
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
        )})}
      </div>
    </div>
  );
}
