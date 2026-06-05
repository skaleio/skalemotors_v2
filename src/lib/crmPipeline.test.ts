import { describe, expect, it } from "vitest";
import {
  aggregateLeadsByCrmStage,
  CRM_PIPELINE_STAGES,
  coerceCrmPipelineStatus,
  crmStageToDbStatus,
  getLeadCrmStageKey,
  leadBelongsToCrmStage,
  safePipelineSelectValue,
} from "./crmPipeline";

describe("crmPipeline", () => {
  it("mapea estados legacy a la columna correcta", () => {
    expect(getLeadCrmStageKey("nuevo")).toBe("nuevo");
    expect(getLeadCrmStageKey("cotizando")).toBe("negociando");
    expect(getLeadCrmStageKey("en_espera")).toBe("en_espera");
    expect(getLeadCrmStageKey("vendido")).toBe("negocio_cerrado");
    expect(getLeadCrmStageKey("perdido")).toBeNull();
  });

  it("detecta pertenencia a columna por bucket, no solo por string exacto", () => {
    expect(leadBelongsToCrmStage("cotizando", "negociando")).toBe(true);
    expect(leadBelongsToCrmStage("interesado", "contactado")).toBe(true);
    expect(leadBelongsToCrmStage("negociando", "en_espera")).toBe(false);
    expect(leadBelongsToCrmStage("para_cierre", "en_espera")).toBe(false);
  });

  it("convierte columna CRM a status DB al mover", () => {
    expect(crmStageToDbStatus("nuevo")).toBe("nuevo");
    expect(crmStageToDbStatus("en_espera")).toBe("en_espera");
    expect(crmStageToDbStatus("negociando")).toBe("negociando");
    expect(crmStageToDbStatus("negocio_cerrado")).toBe("vendido");
    expect(coerceCrmPipelineStatus("negocio_cerrado")).toBe("vendido");
  });

  it("mantiene orden del embudo con en_espera entre negociando y para_cierre", () => {
    const keys = CRM_PIPELINE_STAGES.map((s) => s.key);
    expect(keys).toEqual([
      "nuevo",
      "contactado",
      "negociando",
      "en_espera",
      "para_cierre",
      "negocio_cerrado",
    ]);
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
