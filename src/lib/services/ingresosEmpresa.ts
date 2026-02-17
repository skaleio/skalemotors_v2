import { supabase } from "../supabase";
import type { Database } from "../types/database";

type IngresoEmpresa = Database["public"]["Tables"]["ingresos_empresa"]["Row"];
type IngresoEmpresaInsert = Database["public"]["Tables"]["ingresos_empresa"]["Insert"];

export const ingresosEmpresaService = {
  async getAll(filters?: { branchId?: string; fromDate?: string; toDate?: string }): Promise<IngresoEmpresa[]> {
    let query = supabase
      .from("ingresos_empresa")
      .select("*")
      .order("income_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters?.branchId) {
      query = query.eq("branch_id", filters.branchId);
    }
    if (filters?.fromDate) {
      query = query.gte("income_date", filters.fromDate);
    }
    if (filters?.toDate) {
      query = query.lte("income_date", filters.toDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as IngresoEmpresa[];
  },

  async create(payload: IngresoEmpresaInsert): Promise<IngresoEmpresa> {
    const { data, error } = await supabase
      .from("ingresos_empresa")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as IngresoEmpresa;
  },
};
