import { supabase } from "@/lib/supabase";
import type { DocumentType } from "@/lib/services/documents";
import {
  DEFAULT_CONSIGNACION_CLAUSES,
  DEFAULT_RESERVA_CLAUSES,
  DEFAULT_VENTA_CLAUSES,
} from "@/lib/documents/defaultTemplates";
import {
  mergeTemplateSettings,
  type DocumentClause,
  type DocumentTemplate,
  type DocumentTemplateSettings,
} from "@/lib/documents/templateTypes";

function parseClauses(raw: unknown): DocumentClause[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const row = c as Record<string, unknown>;
      return {
        id: String(row.id ?? ""),
        title: String(row.title ?? ""),
        body: String(row.body ?? ""),
      };
    })
    .filter((c) => c.id && c.body);
}

function rowToTemplate(row: Record<string, unknown>): DocumentTemplate {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    branch_id: row.branch_id ? String(row.branch_id) : null,
    type: row.type as DocumentType,
    name: String(row.name),
    is_default: Boolean(row.is_default),
    clauses: parseClauses(row.clauses),
    settings: mergeTemplateSettings(row.settings),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function builtInTemplate(type: DocumentType): Omit<DocumentTemplate, "id" | "tenant_id" | "created_at" | "updated_at"> {
  return {
    branch_id: null,
    type,
    name:
      type === "contrato_consignacion"
        ? "Consignación (predeterminada)"
        : type === "nota_reserva"
          ? "Reserva (predeterminada)"
          : "Venta (predeterminada)",
    is_default: true,
    clauses:
      type === "contrato_consignacion"
        ? DEFAULT_CONSIGNACION_CLAUSES
        : type === "nota_reserva"
          ? DEFAULT_RESERVA_CLAUSES
          : DEFAULT_VENTA_CLAUSES,
    settings: mergeTemplateSettings({}),
  };
}

export const documentTemplateService = {
  async list(type?: DocumentType): Promise<DocumentTemplate[]> {
    let query = supabase
      .from("document_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (type) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((r) => rowToTemplate(r as Record<string, unknown>));
  },

  async getById(id: string): Promise<DocumentTemplate | null> {
    const { data, error } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToTemplate(data as Record<string, unknown>);
  },

  /** Plantilla efectiva: default del tenant en BD, o built-in por código. */
  async resolveForType(type: DocumentType, branchId?: string | null): Promise<DocumentTemplate> {
    let query = supabase
      .from("document_templates")
      .select("*")
      .eq("type", type)
      .eq("is_default", true)
      .limit(1);

    if (branchId) {
      const { data: branchRow } = await supabase
        .from("document_templates")
        .select("*")
        .eq("type", type)
        .eq("is_default", true)
        .eq("branch_id", branchId)
        .maybeSingle();
      if (branchRow) return rowToTemplate(branchRow as Record<string, unknown>);
    }

    const { data, error } = await query.is("branch_id", null).maybeSingle();
    if (error) throw error;

    if (data) {
      return rowToTemplate(data as Record<string, unknown>);
    }

    const builtin = builtInTemplate(type);
    return {
      ...builtin,
      id: "builtin",
      tenant_id: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async create(input: {
    tenant_id: string;
    branch_id?: string | null;
    type: DocumentType;
    name: string;
    is_default?: boolean;
    clauses: DocumentClause[];
    settings?: DocumentTemplateSettings;
  }): Promise<DocumentTemplate> {
    if (input.is_default) {
      await supabase
        .from("document_templates")
        .update({ is_default: false })
        .eq("type", input.type)
        .is("branch_id", input.branch_id ?? null);
    }

    const { data, error } = await supabase
      .from("document_templates")
      .insert({
        tenant_id: input.tenant_id,
        branch_id: input.branch_id ?? null,
        type: input.type,
        name: input.name,
        is_default: input.is_default ?? false,
        clauses: input.clauses,
        settings: input.settings ?? mergeTemplateSettings({}),
      })
      .select("*")
      .single();

    if (error) throw error;
    return rowToTemplate(data as Record<string, unknown>);
  },

  async update(
    id: string,
    updates: {
      name?: string;
      is_default?: boolean;
      clauses?: DocumentClause[];
      settings?: DocumentTemplateSettings;
    }
  ): Promise<DocumentTemplate> {
    const { data, error } = await supabase
      .from("document_templates")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToTemplate(data as Record<string, unknown>);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("document_templates").delete().eq("id", id);
    if (error) throw error;
  },
};
