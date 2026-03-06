import { supabase } from "../supabase";
import type { Database } from "../types/database";

type SearchLogRow = Database["public"]["Tables"]["chileautos_search_log"]["Row"];
type SearchLogInsert = Database["public"]["Tables"]["chileautos_search_log"]["Insert"];

export type SearchMetric = {
  search_keyword: string;
  count: number;
};

export const chileautosSearchLogService = {
  /** Registra una búsqueda (al pulsar Buscar o al hacer clic en un modelo). */
  async log(
    searchKeyword: string,
    options?: { branchId?: string | null }
  ): Promise<SearchLogRow> {
    const normalized = searchKeyword.trim();
    if (!normalized) throw new Error("search_keyword requerido");
    const { data: user } = await supabase.auth.getUser();
    const payload: SearchLogInsert = {
      search_keyword: normalized,
      branch_id: options?.branchId ?? null,
      user_id: user.data.user?.id ?? null,
    };
    const { data, error } = await supabase
      .from("chileautos_search_log")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as SearchLogRow;
  },

  /** Métricas: modelos más buscados (recuento por search_keyword). */
  async getSearchMetrics(filters?: { branchId?: string | null }): Promise<SearchMetric[]> {
    let query = supabase
      .from("chileautos_search_log")
      .select("search_keyword");
    if (filters?.branchId) {
      query = query.or(`branch_id.eq.${filters.branchId},branch_id.is.null`);
    }
    const { data: rows, error } = await query;
    if (error) throw error;
    const byKeyword = new Map<string, number>();
    for (const r of rows ?? []) {
      const k = (r.search_keyword || "").trim();
      if (k) byKeyword.set(k, (byKeyword.get(k) || 0) + 1);
    }
    return [...byKeyword.entries()]
      .map(([search_keyword, count]) => ({ search_keyword, count }))
      .sort((a, b) => b.count - a.count);
  },
};
