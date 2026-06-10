import { describe, expect, it } from "vitest";
import {
  aggregateLeadsByCrmStage,
  CRM_PIPELINE_STAGES,
  coerceCrmPipelineStatus,
  crmStageToDbStatus,
  filterLeadsForCrmCeoView,
  getLeadCrmStageKey,
  isLeadHiddenFromCeoNuevoColumn,
  isLeadVisibleInCrmKanban,
  leadBelongsToCrmStage,
  pickCancelledLeadIdsVisibleInCrm,
  safePipelineSelectValue,
} from "./crmPipeline";

describe("crmPipeline", () => {
  it("mapea estados legacy a la columna correcta", () => {
    expect(getLeadCrmStageKey("nuevo")).toBe("nuevo");
    expect(getLeadCrmStageKey("cotizando")).toBe("negociando");
    expect(getLeadCrmStageKey("en_espera")).toBe("en_espera");
    expect(getLeadCrmStageKey("vendido")).toBe("negocio_cerrado");
    expect(getLeadCrmStageKey("cancelado")).toBe("cancelado");
    expect(getLeadCrmStageKey("perdido")).toBeNull();
  });

  it("detecta pertenencia a columna por bucket, no solo por string exacto", () => {
    expect(leadBelongsToCrmStage("cotizando", "negociando")).toBe(true);
    expect(leadBelongsToCrmStage("interesado", "contactado")).toBe(true);
    expect(leadBelongsToCrmStage("negociando", "en_espera")).toBe(false);
    expect(leadBelongsToCrmStage("para_cierre", "en_espera")).toBe(false);
  });

  it("Vista CEO oculta leads NUEVO ya asignados a vendedor", () => {
    const leads = [
      { id: "1", status: "nuevo", assigned_to: null },
      { id: "2", status: "nuevo", assigned_to: "vendor-uuid" },
      { id: "3", status: "contactado", assigned_to: "vendor-uuid" },
    ];
    expect(isLeadHiddenFromCeoNuevoColumn(leads[0])).toBe(false);
    expect(isLeadHiddenFromCeoNuevoColumn(leads[1])).toBe(true);
    expect(isLeadHiddenFromCeoNuevoColumn(leads[2])).toBe(false);
    expect(filterLeadsForCrmCeoView(leads).map((l) => l.id)).toEqual(["1", "3"]);
  });

  it("convierte columna CRM a status DB al mover", () => {
    expect(crmStageToDbStatus("nuevo")).toBe("nuevo");
    expect(crmStageToDbStatus("en_espera")).toBe("en_espera");
    expect(crmStageToDbStatus("negociando")).toBe("negociando");
    expect(crmStageToDbStatus("negocio_cerrado")).toBe("vendido");
    expect(crmStageToDbStatus("cancelado")).toBe("cancelado");
    expect(coerceCrmPipelineStatus("negocio_cerrado")).toBe("vendido");
  });

  it("solo muestra los 5 cancelados más recientes en CRM", () => {
    const leads = [
      { id: "1", status: "cancelado", updated_at: "2026-01-01T00:00:00Z" },
      { id: "2", status: "cancelado", updated_at: "2026-06-01T00:00:00Z" },
      { id: "3", status: "cancelado", updated_at: "2026-05-01T00:00:00Z" },
      { id: "4", status: "cancelado", updated_at: "2026-04-01T00:00:00Z" },
      { id: "5", status: "cancelado", updated_at: "2026-03-01T00:00:00Z" },
      { id: "6", status: "cancelado", updated_at: "2026-02-01T00:00:00Z" },
      { id: "7", status: "contactado", updated_at: "2026-01-01T00:00:00Z" },
    ];
    const visible = pickCancelledLeadIdsVisibleInCrm(leads);
    expect(visible.size).toBe(5);
    expect(visible.has("2")).toBe(true);
    expect(visible.has("1")).toBe(false);
    expect(isLeadVisibleInCrmKanban(leads[0], visible)).toBe(false);
    expect(isLeadVisibleInCrmKanban(leads[6], visible)).toBe(true);
  });

  it("mantiene orden del embudo con agendado y negociando después de en_espera", () => {
    const keys = CRM_PIPELINE_STAGES.map((s) => s.key);
    expect(keys).toEqual([
      "nuevo",
      "contactado",
      "agendado",
      "en_espera",
      "negociando",
      "para_cierre",
      "negocio_cerrado",
      "cancelado",
    ]);
  });

  it("mapea agendado a su columna", () => {
    expect(getLeadCrmStageKey("agendado")).toBe("agendado");
    expect(crmStageToDbStatus("agendado")).toBe("agendado");
  });

  it("reconoce claves de columna del pipeline en selects del formulario", () => {
    expect(getLeadCrmStageKey("negocio_cerrado")).toBe("negocio_cerrado");
    expect(safePipelineSelectValue("negocio_cerrado")).toBe("negocio_cerrado");
    expect(crmStageToDbStatus("negocio_cerrado")).toBe("vendido");
    expect(crmStageToDbStatus("perdido")).toBe("perdido");
  });

  it("safePipelineSelectValue alinea select con columna", () => {
    expect(safePipelineSelectValue("cotizando")).toBe("negociando");
    expect(safePipelineSelectValue("en_espera")).toBe("en_espera");
  });

  it("aggregateLeadsByCrmStage agrupa legacy y excluye perdidos del pipeline activo", () => {
    const result = aggregateLeadsByCrmStage([
      { status: "nuevo", count: 3 },
      { status: "interesado", count: 2 },
      { status: "cotizando", count: 4 },
      { status: "vendido", count: 1 },
      { status: "perdido", count: 2 },
    ]);

    expect(result.stages.find((s) => s.stageKey === "nuevo")?.count).toBe(3);
    expect(result.stages.find((s) => s.stageKey === "contactado")?.count).toBe(2);
    expect(result.stages.find((s) => s.stageKey === "negociando")?.count).toBe(4);
    expect(result.stages.find((s) => s.stageKey === "negocio_cerrado")?.count).toBe(1);
    expect(result.perdidos).toBe(2);
    expect(result.totalInPipeline).toBe(9);
  });
});
