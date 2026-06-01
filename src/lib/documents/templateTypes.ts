import type { DocumentType } from "@/lib/services/documents";

export interface DocumentClause {
  id: string;
  title: string;
  body: string;
}

export interface DocumentTemplateSections {
  consignor: boolean;
  vehicle: boolean;
  consignment_details: boolean;
  buyer: boolean;
  economic: boolean;
  terms: boolean;
  signatures: boolean;
  observations: boolean;
}

export type DocumentDensity = "normal" | "compact" | "minimal";

export interface DocumentTemplateSettings {
  sections: DocumentTemplateSections;
  density: DocumentDensity;
  title?: string;
}

export interface DocumentTemplate {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  type: DocumentType;
  name: string;
  is_default: boolean;
  clauses: DocumentClause[];
  settings: DocumentTemplateSettings;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_SECTIONS: DocumentTemplateSections = {
  consignor: true,
  vehicle: true,
  consignment_details: true,
  buyer: true,
  economic: true,
  terms: true,
  signatures: true,
  observations: true,
};

export function mergeTemplateSettings(
  raw: unknown
): DocumentTemplateSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sectionsRaw =
    o.sections && typeof o.sections === "object"
      ? (o.sections as Partial<DocumentTemplateSections>)
      : {};
  const density =
    o.density === "compact" || o.density === "minimal" ? o.density : "normal";
  return {
    sections: { ...DEFAULT_SECTIONS, ...sectionsRaw },
    density,
    title: typeof o.title === "string" ? o.title : undefined,
  };
}

export function mergeLayoutSettings(
  template: DocumentTemplateSettings,
  instance: unknown
): DocumentTemplateSettings {
  if (!instance || typeof instance !== "object") return template;
  const o = instance as Record<string, unknown>;
  return mergeTemplateSettings({
    ...template,
    ...o,
    sections: {
      ...template.sections,
      ...(o.sections && typeof o.sections === "object"
        ? (o.sections as Partial<DocumentTemplateSections>)
        : {}),
    },
  });
}
