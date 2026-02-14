import { supabase } from "../supabase";
import type { Database } from "../types/database";

type GastoEmpresa = Database["public"]["Tables"]["gastos_empresa"]["Row"];
type GastoEmpresaInsert = Database["public"]["Tables"]["gastos_empresa"]["Insert"];
type GastoEmpresaUpdate = Database["public"]["Tables"]["gastos_empresa"]["Update"];

export type ExpenseType = GastoEmpresa["expense_type"];

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  operacion: "Operación",
  marketing: "Marketing",
  servicios: "Servicios",
  mantenimiento: "Mantenimiento",
  combustible: "Combustible",
  seguros: "Seguros",
  impuestos: "Impuestos",
  personal: "Personal",
  vehiculos: "Vehículos",
  otros: "Otros",
};

export type GastoEmpresaWithInversor = GastoEmpresa & {
  inversor?: { id: string; full_name: string | null } | null;
  branch?: { id: string; name: string } | null;
};

export const gastosEmpresaService = {
  async getAll(filters?: {
    branchId?: string;
    expenseType?: ExpenseType;
    inversorId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<GastoEmpresaWithInversor[]> {
    let query = supabase
      .from("gastos_empresa")
      .select(
        `
        *,
        inversor:users!gastos_empresa_inversor_id_fkey(id, full_name),
        branch:branches!gastos_empresa_branch_id_fkey(id, name)
      `
      )
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters?.branchId) {
      query = query.eq("branch_id", filters.branchId);
    }
    if (filters?.expenseType) {
      query = query.eq("expense_type", filters.expenseType);
    }
    if (filters?.inversorId) {
      query = query.eq("inversor_id", filters.inversorId);
    }
    if (filters?.fromDate) {
      query = query.gte("expense_date", filters.fromDate);
    }
    if (filters?.toDate) {
      query = query.lte("expense_date", filters.toDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching gastos_empresa:", error);
      throw error;
    }
    return (data ?? []) as GastoEmpresaWithInversor[];
  },

  async create(payload: GastoEmpresaInsert): Promise<GastoEmpresaWithInversor> {
    const { data, error } = await supabase
      .from("gastos_empresa")
      .insert(payload)
      .select(
        `
        *,
        inversor:users!gastos_empresa_inversor_id_fkey(id, full_name),
        branch:branches!gastos_empresa_branch_id_fkey(id, name)
      `
      )
      .single();

    if (error) {
      console.error("Error creating gasto:", error);
      throw error;
    }
    if (!data) throw new Error("No data returned after creating gasto");
    return data as GastoEmpresaWithInversor;
  },

  async update(id: string, updates: GastoEmpresaUpdate): Promise<GastoEmpresaWithInversor> {
    const { data, error } = await supabase
      .from("gastos_empresa")
      .update(updates)
      .eq("id", id)
      .select(
        `
        *,
        inversor:users!gastos_empresa_inversor_id_fkey(id, full_name),
        branch:branches!gastos_empresa_branch_id_fkey(id, name)
      `
      )
      .single();

    if (error) {
      console.error("Error updating gasto:", error);
      throw error;
    }
    if (!data) throw new Error("No data returned after updating gasto");
    return data as GastoEmpresaWithInversor;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("gastos_empresa").delete().eq("id", id);
    if (error) throw error;
  },
};
