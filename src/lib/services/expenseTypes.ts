import { supabase } from "../supabase";
import type { Database } from "../types/database";

export type ExpenseTypeRow = Database["public"]["Tables"]["expense_types"]["Row"];
export type ExpenseTypeInsert = Database["public"]["Tables"]["expense_types"]["Insert"];
export type ExpenseTypeUpdate = Database["public"]["Tables"]["expense_types"]["Update"];

export const expenseTypesService = {
  async getAll(): Promise<ExpenseTypeRow[]> {
    const { data, error } = await supabase
      .from("expense_types")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ExpenseTypeRow[];
  },

  async create(payload: { code: string; label: string; sort_order?: number }): Promise<ExpenseTypeRow> {
    const code = payload.code.trim().toLowerCase().replace(/\s+/g, "_");
    const { data, error } = await supabase
      .from("expense_types")
      .insert({ code, label: payload.label.trim(), sort_order: payload.sort_order ?? 0 })
      .select()
      .single();
    if (error) throw error;
    return data as ExpenseTypeRow;
  },

  async update(id: string, payload: Partial<ExpenseTypeUpdate>): Promise<ExpenseTypeRow> {
    const update: ExpenseTypeUpdate = { updated_at: new Date().toISOString() };
    if (payload.label !== undefined) update.label = payload.label.trim();
    if (payload.code !== undefined) update.code = payload.code.trim().toLowerCase().replace(/\s+/g, "_");
    if (payload.sort_order !== undefined) update.sort_order = payload.sort_order;
    const { data, error } = await supabase.from("expense_types").update(update).eq("id", id).select().single();
    if (error) throw error;
    return data as ExpenseTypeRow;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("expense_types").delete().eq("id", id);
    if (error) throw error;
  },

  /** Cuenta cuántos gastos usan este tipo (por code). */
  async countGastosByCode(code: string): Promise<number> {
    const { count, error } = await supabase
      .from("gastos_empresa")
      .select("*", { count: "exact", head: true })
      .eq("expense_type", code);
    if (error) throw error;
    return count ?? 0;
  },
};
