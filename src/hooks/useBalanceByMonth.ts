import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface BalanceMonth {
  income: number;
  expenses: number;
  balance: number;
}

/**
 * Balance real por mes: ingresos (ventas margin + ingresos_empresa realizados) - gastos_empresa.
 * Claves en byMonth: "YYYY-MM" (ej. "2026-01").
 */
export function useBalanceByMonth(branchId: string | null | undefined, year: number) {
  const from = `${year}-01-01`;
  const toDate = new Date(year, 11, 31);
  const to = toDate.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["balance-by-month", branchId, year, from, to],
    queryFn: async (): Promise<Record<string, BalanceMonth>> => {
      const monthMap: Record<string, { income: number; expenses: number }> = {};
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, "0")}`;
        monthMap[key] = { income: 0, expenses: 0 };
      }

      // Ventas completadas con pago realizado (margin = ganancia)
      let salesQuery = supabase
        .from("sales")
        .select("sale_date, margin")
        .eq("status", "completada")
        .eq("payment_status", "realizado")
        .gte("sale_date", from)
        .lte("sale_date", to);
      if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);
      const { data: salesData } = await salesQuery;
      (salesData ?? []).forEach((s: { sale_date: string; margin: number | null }) => {
        const d = new Date(s.sale_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap[key]) {
          monthMap[key].income += Number(s.margin ?? 0);
        }
      });

      // Ingresos empresa (solo realizados)
      let ingresosQuery = supabase
        .from("ingresos_empresa")
        .select("income_date, amount, payment_status")
        .gte("income_date", from)
        .lte("income_date", to);
      if (branchId) ingresosQuery = ingresosQuery.eq("branch_id", branchId);
      const { data: ingresosData } = await ingresosQuery;
      (ingresosData ?? [])
        .filter((i: { payment_status?: string }) => (i.payment_status ?? "realizado") === "realizado")
        .forEach((i: { income_date: string; amount: number | null }) => {
          const d = new Date(i.income_date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (monthMap[key]) {
            monthMap[key].income += Number(i.amount ?? 0);
          }
        });

      // Gastos empresa
      let gastosQuery = supabase
        .from("gastos_empresa")
        .select("expense_date, amount")
        .gte("expense_date", from)
        .lte("expense_date", to);
      if (branchId) gastosQuery = gastosQuery.eq("branch_id", branchId);
      const { data: gastosData } = await gastosQuery;
      (gastosData ?? []).forEach((g: { expense_date: string; amount: number | null }) => {
        const d = new Date(g.expense_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap[key]) {
          monthMap[key].expenses += Number(g.amount ?? 0);
        }
      });

      const result: Record<string, BalanceMonth> = {};
      for (const [key, v] of Object.entries(monthMap)) {
        result[key] = {
          income: v.income,
          expenses: v.expenses,
          balance: v.income - v.expenses,
        };
      }
      return result;
    },
    enabled: year >= 2000 && year <= 2100,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
