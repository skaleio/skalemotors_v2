import { supabase } from "../supabase";
import type { Database } from "../types/database";

type Row = Database["public"]["Tables"]["salary_distribution"]["Row"];
type Insert = Database["public"]["Tables"]["salary_distribution"]["Insert"];
type Update = Database["public"]["Tables"]["salary_distribution"]["Update"];

export type MonthData = {
  profit: number;
  amounts: Record<string, number>;
};

export type StoredData = Record<string, MonthData>;

function yearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export const salaryDistributionService = {
  /**
   * Obtiene todos los registros de distribución para una sucursal y los devuelve
   * en el mismo formato que antes usaba localStorage (Record<"YYYY-MM", MonthData>).
   */
  async getByBranch(branchId: string | null): Promise<StoredData> {
    if (!branchId) return {};
    const { data, error } = await supabase
      .from("salary_distribution")
      .select("year, month, profit, amounts")
      .eq("branch_id", branchId)
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) {
      console.error("Error fetching salary_distribution:", error);
      throw error;
    }

    const result: StoredData = {};
    (data ?? []).forEach((row: { year: number; month: number; profit: number; amounts: Record<string, number> }) => {
      const key = yearMonthKey(row.year, row.month);
      result[key] = {
        profit: Number(row.profit ?? 0),
        amounts: (row.amounts && typeof row.amounts === "object") ? { ...row.amounts } : {},
      };
    });
    return result;
  },

  /**
   * Crea o actualiza el registro de un mes para la sucursal.
   */
  async upsertMonth(
    branchId: string,
    year: number,
    month: number,
    profit: number,
    amounts: Record<string, number>
  ): Promise<void> {
    const { error } = await supabase.from("salary_distribution").upsert(
      {
        branch_id: branchId,
        year,
        month,
        profit,
        amounts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "branch_id,year,month" }
    );
    if (error) throw error;
  },
};
