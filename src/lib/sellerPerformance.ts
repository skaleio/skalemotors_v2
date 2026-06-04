export const DEFAULT_MONTHLY_SALES_GOAL = 5;

export function resolveMonthlySalesGoal(
  staffGoal: number | null | undefined,
  tenantDefault: number,
): number {
  if (staffGoal != null && staffGoal > 0) return staffGoal;
  const base = tenantDefault > 0 ? tenantDefault : DEFAULT_MONTHLY_SALES_GOAL;
  return base;
}

export function computeSellerPerformance(salesCount: number, goal: number) {
  const safeGoal = Math.max(1, goal);
  const percent = Math.min(100, Math.round((salesCount / safeGoal) * 100));
  const exceeded = salesCount >= safeGoal;
  return {
    percent,
    safeGoal,
    exceeded,
    salesCount,
    label: `${salesCount} de ${safeGoal} ventas`,
  };
}
