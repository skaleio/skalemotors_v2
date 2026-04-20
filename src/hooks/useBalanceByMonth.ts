import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

/** Mismo criterio que Finanzas: ingresos con esta etiqueta van al Pozo Hessen, no al balance operativo. */
const INGRESO_ETIQUETA_AHORRO_POZO = "Ahorro pozo";

/**
 * Solo los gastos con inversor HessenMotors son gastos reales de la empresa.
 * Gastos de Jota/Mike/Ronald/Antonio = inversión del bolsillo del socio (no restan balance).
 * Gastos de Pozo Hessen = salen del Pozo, no del balance.
 * Sin inversor definido → no toca el balance (no asumimos empresa).
 */
const INVERSOR_EMPRESA_LOWER = "hessenmotors";

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
        .select("income_date, amount, payment_status, etiqueta")
        .gte("income_date", from)
        .lte("income_date", to);
      const { data: ingresosData } = await ingresosQuery;
      (ingresosData ?? [])
        .filter((i: { payment_status?: string; etiqueta?: string | null }) => {
          if ((i.payment_status ?? "realizado") !== "realizado") return false;
          if ((i.etiqueta || "").trim() === INGRESO_ETIQUETA_AHORRO_POZO) return false;
          return true;
        })
        .forEach((i: { income_date: string; amount: number | null }) => {
          const d = parseLocalDate(i.income_date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (monthMap[key]) {
            monthMap[key].income += Number(i.amount ?? 0);
          }
        });

      // Gastos empresa: solo HessenMotors resta balance. Jota/Mike/Ronald/Antonio son plata del socio y Pozo Hessen descuenta del Pozo.
      let gastosQuery = supabase
        .from("gastos_empresa")
        .select("expense_date, amount, inversor_name")
        .gte("expense_date", from)
        .lte("expense_date", to);
      const { data: gastosData } = await gastosQuery;
      (gastosData ?? [])
        .filter((g: { inversor_name?: string | null }) =>
          (g.inversor_name ?? "").trim().toLowerCase() === INVERSOR_EMPRESA_LOWER
        )
        .forEach((g: { expense_date: string; amount: number | null }) => {
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
