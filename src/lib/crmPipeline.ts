/**
 * Pipeline CRM: una sola fuente de verdad para columnas, estados DB y drag-and-drop.
 */

export type CrmStageKey =
  | "nuevo"
  | "contactado"
  | "negociando"
  | "en_espera"
  | "para_cierre"
  | "negocio_cerrado"
  | "cancelado";

export type CrmStageDefinition = {
  key: CrmStageKey;
  label: string;
  /** Valores legacy de `leads.status` que se muestran en esta columna. */
  statuses: readonly string[];
};

/** Orden visual del embudo (izquierda → derecha). */
export const CRM_PIPELINE_STAGES: readonly CrmStageDefinition[] = [
  {
    key: "nuevo",
    label: "NUEVO",
    statuses: ["nuevo"],
  },
  {
    key: "contactado",
    label: "CONTACTADO",
    statuses: ["contactado", "interesado"],
  },
  {
    key: "negociando",
    label: "NEGOCIANDO",
    statuses: ["negociando", "cotizando"],
  },
  {
    key: "en_espera",
    label: "EN ESPERA",
    statuses: ["en_espera"],
  },
  {
    key: "para_cierre",
    label: "PARA CIERRE",
    statuses: ["para_cierre"],
  },
  {
    key: "negocio_cerrado",
    label: "NEGOCIO CONCRETADO",
    statuses: ["vendido"],
  },
  {
    key: "cancelado",
    label: "CANCELADO",
    statuses: ["cancelado"],
  },
] as const;

/** Máximo de leads cancelados visibles en el Kanban CRM (el resto sigue en Leads). */
export const CRM_CANCELLED_VISIBLE_MAX = 5;

/** Columnas donde el usuario puede mover leads sin flujo de cierre de negocio. */
export const CRM_MOVABLE_STAGE_KEYS: readonly Exclude<CrmStageKey, "negocio_cerrado">[] = [
  "nuevo",
  "contactado",
  "negociando",
  "en_espera",
  "para_cierre",
];

export const CRM_PIPELINE_STATUS_LABELS: Record<CrmStageKey, string> = {
  nuevo: "NUEVO",
  contactado: "CONTACTADO",
  negociando: "NEGOCIANDO",
  en_espera: "EN ESPERA",
  para_cierre: "PARA CIERRE",
  negocio_cerrado: "NEGOCIO CONCRETADO",
  cancelado: "CANCELADO",
};

/** Estilos de pill / banner alineados con las columnas del pipeline. */
export const CRM_STAGE_PILL_CLASS: Record<CrmStageKey, string> = {
  nuevo:
    "border-cyan-200/80 bg-cyan-50 text-cyan-800 dark:border-cyan-800/60 dark:bg-cyan-950/50 dark:text-cyan-200",
  contactado:
    "border-blue-200/80 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/50 dark:text-blue-200",
  negociando:
    "border-orange-200/80 bg-orange-50 text-orange-800 dark:border-orange-800/60 dark:bg-orange-950/50 dark:text-orange-200",
  en_espera:
    "border-violet-200/80 bg-violet-50 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-200",
  para_cierre:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  negocio_cerrado:
    "border-red-200/80 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-200",
  cancelado:
    "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
};

export const CRM_STAGE_DOT_CLASS: Record<CrmStageKey, string> = {
  nuevo: "bg-cyan-500",
  contactado: "bg-blue-500",
  negociando: "bg-orange-500",
  en_espera: "bg-violet-500",
  para_cierre: "bg-emerald-500",
  negocio_cerrado: "bg-red-600",
  cancelado: "bg-rose-500",
};

/** Borde superior de columnas Kanban y acentos en tarjetas métricas. */
export const CRM_STAGE_BORDER_CLASS: Record<CrmStageKey, string> = {
  nuevo: "border-cyan-500",
  contactado: "border-blue-500",
  negociando: "border-orange-500",
  en_espera: "border-violet-500",
  para_cierre: "border-emerald-500",
  negocio_cerrado: "border-red-600",
  cancelado: "border-rose-500",
};

/** Color de texto para badges compactos en tablas. */
export const CRM_STAGE_TEXT_CLASS: Record<CrmStageKey, string> = {
  nuevo: "text-cyan-700 dark:text-cyan-300",
  contactado: "text-blue-700 dark:text-blue-300",
  negociando: "text-orange-700 dark:text-orange-300",
  en_espera: "text-violet-700 dark:text-violet-300",
  para_cierre: "text-emerald-700 dark:text-emerald-300",
  negocio_cerrado: "text-red-700 dark:text-red-300",
  cancelado: "text-rose-700 dark:text-rose-300",
};

/** Estados activos del embudo (excluye vendido/perdido). */
export const CRM_PIPELINE_ACTIVE_DB_STATUSES = new Set([
  "contactado",
  "nuevo",
  "interesado",
  "negociando",
  "cotizando",
  "en_espera",
  "para_cierre",
]);

function normalizeLeadStatus(status: string | null | undefined): string {
  return (status || "").trim().toLowerCase();
}

/**
 * Columna CRM donde debe mostrarse un `leads.status` (mapea legacy → bucket).
 */
export function getLeadCrmStageKey(status: string | null | undefined): CrmStageKey | null {
  const s = normalizeLeadStatus(status);
  if (!s || s === "perdido") return null;
  if (s === "cancelado") return "cancelado";
  if (s === "vendido") return "negocio_cerrado";
  if (s === "negociando" || s === "cotizando") return "negociando";
  if (s === "en_espera") return "en_espera";
  if (s === "para_cierre") return "para_cierre";
  if (s === "nuevo") return "nuevo";
  if (s === "contactado" || s === "interesado") return "contactado";
  return "contactado";
}

/** Valor para <Select> del pipeline (clave de columna, no siempre = status DB). */
export function safePipelineSelectValue(status: string | null | undefined): CrmStageKey {
  return getLeadCrmStageKey(status) ?? "contactado";
}

export function leadBelongsToCrmStage(
  status: string | null | undefined,
  stageKey: CrmStageKey,
): boolean {
  return getLeadCrmStageKey(status) === stageKey;
}

/** `leads.status` canónico al soltar o guardar desde una columna. */
export function crmStageToDbStatus(stageKey: string): string {
  if (stageKey === "negocio_cerrado") return "vendido";
  if (stageKey === "cancelado") return "cancelado";
  if (
    stageKey === "nuevo"
    || stageKey === "contactado"
    || stageKey === "negociando"
    || stageKey === "en_espera"
    || stageKey === "para_cierre"
  ) {
    return stageKey;
  }
  return "contactado";
}

/** UI / formularios que envían clave de columna en lugar de status DB. */
export function coerceCrmPipelineStatus(status: unknown, fallback = "contactado"): string {
  const s = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (!s) return fallback;
  return crmStageToDbStatus(s);
}

/** IDs de cancelados que pueden verse en CRM (los `CRM_CANCELLED_VISIBLE_MAX` más recientes). */
export function pickCancelledLeadIdsVisibleInCrm<
  T extends { id: string; status?: string | null; updated_at?: string | null },
>(leads: readonly T[]): Set<string> {
  const cancelled = leads
    .filter((l) => normalizeLeadStatus(l.status) === "cancelado")
    .slice()
    .sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    });
  return new Set(cancelled.slice(0, CRM_CANCELLED_VISIBLE_MAX).map((l) => l.id));
}

export function isLeadVisibleInCrmKanban<
  T extends { id: string; status?: string | null },
>(lead: T, visibleCancelledIds: Set<string>): boolean {
  if (normalizeLeadStatus(lead.status) !== "cancelado") return true;
  return visibleCancelledIds.has(lead.id);
}

export type CrmStageCount = {
  stageKey: CrmStageKey;
  label: string;
  count: number;
};

export type LeadsByCrmStageAggregate = {
  stages: CrmStageCount[];
  perdidos: number;
  totalInPipeline: number;
};

/** Agrupa conteos por `status` DB en las columnas del embudo CRM (orden canónico). */
export function aggregateLeadsByCrmStage(
  leadsByStatus: ReadonlyArray<{ status: string; count: number }>,
): LeadsByCrmStageAggregate {
  const counts = new Map<CrmStageKey, number>(
    CRM_PIPELINE_STAGES.map((s) => [s.key, 0]),
  );
  let perdidos = 0;

  for (const { status, count } of leadsByStatus) {
    const stage = getLeadCrmStageKey(status);
    if (stage === null) {
      if (normalizeLeadStatus(status) === "perdido") perdidos += count;
      continue;
    }
    counts.set(stage, (counts.get(stage) ?? 0) + count);
  }

  const stages = CRM_PIPELINE_STAGES.map((s) => ({
    stageKey: s.key,
    label: CRM_PIPELINE_STATUS_LABELS[s.key],
    count: counts.get(s.key) ?? 0,
  }));

  const totalInPipeline = stages
    .filter((s) => s.stageKey !== "negocio_cerrado" && s.stageKey !== "cancelado")
    .reduce((sum, s) => sum + s.count, 0);

  return { stages, perdidos, totalInPipeline };
}
