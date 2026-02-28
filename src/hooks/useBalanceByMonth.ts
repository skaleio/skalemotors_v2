import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface BalanceMonth {
  income: number;
  expenses: number;
  balance: number;
}

/**
 * Balance por mes = mismo criterio que Gastos/Ingresos: solo ingresos_empresa (realizados) − gastos_empresa.
 * En Gastos/Ingresos las ventas NO suman al balance; se cargan ganancias manualmente en "Nuevo Ingreso".
 * Claves en byMonth: "YYYY-MM" (ej. "2026-01").
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

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

      // Ingresos empresa (solo realizados) — igual que Gastos/Ingresos, sin ventas
      let ingresosQuery = supabase
        .from("ingresos_empresa")
        .select("income_date, amount, payment_status")
        .gte("income_date", from)
        .lte("income_date", to);
      const { data: ingresosData } = await ingresosQuery;
      (ingresosData ?? [])
        .filter((i: { payment_status?: string }) => (i.payment_status ?? "realizado") === "realizado")
        .forEach((i: { income_date: string; amount: number | null }) => {
          const d = parseLocalDate(i.income_date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (monthMap[key]) {
            monthMap[key].income += Number(i.amount ?? 0);
          }
        });

      // Gastos empresa — igual que Gastos/Ingresos (sin filtro de sucursal)
      let gastosQuery = supabase
        .from("gastos_empresa")
        .select("expense_date, amount")
        .gte("expense_date", from)
        .lte("expense_date", to);
      const { data: gastosData } = await gastosQuery;
      (gastosData ?? []).forEach((g: { expense_date: string; amount: number | null }) => {
        const d = parseLocalDate(g.expense_date);
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
