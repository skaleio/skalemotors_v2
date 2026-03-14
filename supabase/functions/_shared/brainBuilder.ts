/**
 * Construye el snapshot de cerebro del negocio (inventario, consignaciones, ventas, leads, finanzas).
 * Compartido por ai-chat y ai-brain-refresh.
 */
export async function buildBranchBrain(
  supabase: { from: (table: string) => any },
  branchId: string | null
): Promise<string> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const from = sixMonthsAgo.toISOString().split("T")[0];
  const to = now.toISOString().split("T")[0];

  const eqBranch = (q: any) => (branchId ? q.eq("branch_id", branchId) : q);

  const { data: salesData } = await eqBranch(
    supabase.from("sales").select("sale_price, sale_date, margin").gte("sale_date", from).lte("sale_date", to).eq("status", "completada").limit(2000)
  );
  const { data: vehiclesData } = await eqBranch(supabase.from("vehicles").select("id, make, model, year, price, status, created_at").limit(500));
  const { data: leadsData } = await eqBranch(supabase.from("leads").select("status, full_name").limit(5000));
  const { data: appointmentsData } = await eqBranch(
    supabase.from("appointments").select("id, title, scheduled_at, status").gte("scheduled_at", now.toISOString()).eq("status", "programada").limit(500)
  );
  const { data: ingresosData } = await eqBranch(supabase.from("ingresos_empresa").select("amount, income_date").limit(2000));
  const { data: gastosData } = await eqBranch(supabase.from("gastos_empresa").select("amount, expense_type, expense_date").limit(3000));
  const { data: summaryData } = branchId
    ? await supabase.from("finance_month_summary").select("year, month, total_income, total_expenses, balance").eq("branch_id", branchId).order("year", { ascending: false }).order("month", { ascending: false }).limit(3)
    : { data: [] };
  const { data: consignacionesData } = await eqBranch(
    supabase.from("consignaciones").select("vehicle_make, vehicle_model, vehicle_year, status, consignacion_price, owner_name").limit(300)
  );

  const sales = (salesData ?? []) as any[];
  const vehicles = (vehiclesData ?? []) as any[];
  const leads = (leadsData ?? []) as any[];
  const appointmentsDataArr = (appointmentsData ?? []) as any[];
  const ingresosDataArr = (ingresosData ?? []) as any[];
  const gastos = (gastosData ?? []) as any[];
  const summaryArr = (summaryData ?? []) as any[];
  const consignaciones = (consignacionesData ?? []) as any[];

  const salesThisMonth = sales.filter((s: any) => new Date(s.sale_date) >= firstDayOfMonth).length;
  const salesRevenueThisMonth = sales
    .filter((s: any) => new Date(s.sale_date) >= firstDayOfMonth)
    .reduce((sum: number, s: any) => sum + Number(s.sale_price || 0), 0);
  const totalIncome = ingresosDataArr.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
  const totalExpenses = gastos.reduce((sum: number, g: any) => sum + Number(g.amount || 0), 0);
  const balance = totalIncome - totalExpenses;
  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter((v: any) => v.status === "disponible").length;
  const inactive = new Set(["vendido", "perdido"]);
  const activeLeads = leads.filter((l: any) => !inactive.has(l.status)).length;
  const scheduledAppointments = appointmentsDataArr.length;
  const consignacionesByStatus = consignaciones.reduce((acc: Record<string, number>, c: any) => {
    const s = c.status || "Sin estado";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const consignacionesEnVenta = consignaciones.filter((c: any) => c.status === "en_venta" || c.status === "en_revision" || c.status === "nuevo").length;

  const lines: string[] = [
    "--- CEREBRO DEL NEGOCIO (todas las métricas e información) ---",
    "",
    "INVENTARIO DE VEHÍCULOS",
    `- Total: ${totalVehicles}. Disponibles: ${availableVehicles}.`,
    vehicles.length > 0
      ? "- Listado (marca, modelo, año, precio, estado): " +
        vehicles.slice(0, 25).map((v: any) => `${v.make} ${v.model} ${v.year} $${Number(v.price || 0).toLocaleString("es-CL")} (${v.status})`).join("; ")
      : "",
    "",
    "CONSIGNACIONES",
    `- Total registros: ${consignaciones.length}. En venta/revisión/nuevo: ${consignacionesEnVenta}.`,
    "- Por estado: " + Object.entries(consignacionesByStatus).map(([s, n]) => `${s}: ${n}`).join(", ") || "N/A",
    consignaciones.length > 0
      ? "- Ejemplos (marca, modelo, año, estado, precio consignación, dueño): " +
        consignaciones.slice(0, 15).map((c: any) => `${c.vehicle_make || ""} ${c.vehicle_model || ""} ${c.vehicle_year || ""} ${c.status} $${Number(c.consignacion_price || 0).toLocaleString("es-CL")} ${c.owner_name || ""}`).join("; ")
      : "",
    "",
    "VENTAS Y FINANZAS",
    `- Ventas este mes: ${salesThisMonth}. Ingresos por ventas este mes: $${salesRevenueThisMonth.toLocaleString("es-CL")}.`,
    `- Ingresos totales (ingresos_empresa): $${totalIncome.toLocaleString("es-CL")}. Gastos totales: $${totalExpenses.toLocaleString("es-CL")}. Balance: $${balance.toLocaleString("es-CL")}.`,
    summaryArr.length > 0
      ? "- Resúmenes de cierre de mes: " +
        summaryArr.map((s: any) => `${s.year}-${s.month}: ingreso $${Number(s.total_income || 0).toLocaleString("es-CL")}, gastos $${Number(s.total_expenses || 0).toLocaleString("es-CL")}, balance $${Number(s.balance || 0).toLocaleString("es-CL")}`).join("; ")
      : "",
    "",
    "LEADS Y CITAS",
    `- Leads activos: ${activeLeads}. Citas programadas (próximas): ${scheduledAppointments}.`,
    "",
    "--- FIN CEREBRO ---",
  ];

  return lines.filter(Boolean).join("\n");
}
