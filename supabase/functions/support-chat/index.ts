/// <reference path="../_shared/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_HISTORY = 10;
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  message: string;
  branchId?: string | null;
  history?: Array< { role: "user" | "assistant"; content: string } >;
};

const SYSTEM_PROMPT = `Eres el cerebro del negocio de la automotora SKALEMOTORS. Tienes acceso a las métricas actuales del negocio (ventas, inventario, leads, finanzas, citas). Tu rol es responder preguntas sobre el negocio en español de forma clara, concisa y útil.

Reglas:
- Responde siempre en español.
- Usa ÚNICAMENTE los datos del contexto que te proporciono. Si no hay dato para algo, dilo claramente.
- Para montos en pesos chilenos usa formato legible (ej. $1.500.000 o 1,5 millones).
- Si te preguntan tendencias, comparaciones o recomendaciones, basálas en los números que tienes.
- Sé breve en respuestas cortas; desarrolla más si preguntan análisis o detalle.`;

async function fetchBusinessContext(supabase: ReturnType<typeof createClient>, branchId: string | null): Promise<string> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const from = sixMonthsAgo.toISOString().split("T")[0];
  const to = now.toISOString().split("T")[0];
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const fromWeek = weekStart.toISOString().split("T")[0];

  const eqBranch = (q: any) => (branchId ? q.eq("branch_id", branchId) : q);

  const { data: salesData } = await eqBranch(supabase.from("sales").select("sale_price, sale_date, margin").gte("sale_date", from).lte("sale_date", to).eq("status", "completada").limit(2000));
  const { data: vehiclesData } = await eqBranch(supabase.from("vehicles").select("id, status, category"));
  const { data: leadsData } = await eqBranch(supabase.from("leads").select("status").limit(5000));
  const { data: appointmentsData } = await eqBranch(supabase.from("appointments").select("id").gte("scheduled_at", now.toISOString()).eq("status", "programada").limit(500));
  const { data: incomeSalesData } = await eqBranch(supabase.from("sales").select("margin").eq("status", "completada").eq("payment_status", "realizado").limit(3000));
  const { data: ingresosData } = await eqBranch(supabase.from("ingresos_empresa").select("amount").limit(2000));
  const { data: gastosData } = await eqBranch(supabase.from("gastos_empresa").select("amount, expense_type").limit(3000));
  const { data: gastosThisWeekData } = await eqBranch(supabase.from("gastos_empresa").select("amount, expense_type").gte("expense_date", fromWeek).lte("expense_date", to));
  const { data: recentSalesData } = await eqBranch(supabase.from("sales").select("sale_price, sale_date, vehicle_description, client_name, margin").order("sale_date", { ascending: false }).limit(5));

  const sales = (salesData ?? []) as any[];
  const vehicles = (vehiclesData ?? []) as any[];
  const leads = (leadsData ?? []) as any[];
  const appointmentsDataArr = (appointmentsData ?? []) as any[];
  const incomeSalesDataArr = (incomeSalesData ?? []) as any[];
  const ingresosDataArr = (ingresosData ?? []) as any[];
  const gastos = (gastosData ?? []) as any[];
  const gastosThisWeek = (gastosThisWeekData ?? []) as any[];
  const recentSalesArr = (recentSalesData ?? []) as any[];

  const expensesThisWeek = gastosThisWeek.reduce((sum: number, g: any) => sum + Number(g.amount || 0), 0);

  const salesThisMonth = sales.filter((s: any) => new Date(s.sale_date) >= firstDayOfMonth).length;
  const salesRevenueThisMonth = sales
    .filter((s: any) => new Date(s.sale_date) >= firstDayOfMonth)
    .reduce((sum: number, s: any) => sum + Number(s.sale_price || 0), 0);
  const totalSalesRevenue = sales.reduce((sum: number, s: any) => sum + Number(s.sale_price || 0), 0);
  const totalMargin = sales.reduce((sum: number, s: any) => sum + Number(s.margin || 0), 0);

  const monthBuckets: Record<string, { sales: number; revenue: number }> = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthBuckets[key] = { sales: 0, revenue: 0 };
  }
  sales.forEach((s: any) => {
    const d = new Date(s.sale_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthBuckets[key]) {
      monthBuckets[key].sales += 1;
      monthBuckets[key].revenue += Number(s.sale_price || 0);
    }
  });

  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter((v: any) => v.status === "disponible").length;
  const byCategory = vehicles.reduce((acc: Record<string, number>, v: any) => {
    const c = v.category || "Sin categoría";
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});

  const inactive = new Set(["vendido", "perdido"]);
  const activeLeads = leads.filter((l: any) => !inactive.has(l.status)).length;
  const leadsByStatus = leads.reduce((acc: Record<string, number>, l: any) => {
    const s = l.status || "Sin estado";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const scheduledAppointments = appointmentsDataArr.length;

  const incomeFromSales = incomeSalesDataArr.reduce((sum: number, s: any) => sum + Number(s.margin || 0), 0);
  const incomeFromOther = ingresosDataArr.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
  const totalExpenses = gastos.reduce((sum: number, g: any) => sum + Number(g.amount || 0), 0);
  const expensesByCategory = gastos.reduce((acc: Record<string, number>, g: any) => {
    const t = g.expense_type || "Otro";
    acc[t] = (acc[t] || 0) + Number(g.amount || 0);
    return acc;
  }, {});

  const totalIncome = incomeFromSales + incomeFromOther;
  const balance = totalIncome - totalExpenses;

  const lines: string[] = [
    "--- MÉTRICAS ACTUALES DEL NEGOCIO ---",
    "",
    "VENTAS",
    `- Ventas este mes: ${salesThisMonth} (ingresos por ventas este mes: $${salesRevenueThisMonth.toLocaleString("es-CL")})`,
    `- Ingresos totales por ventas (6 meses): $${totalSalesRevenue.toLocaleString("es-CL")}`,
    `- Ganancia total (márgenes, 6 meses): $${totalMargin.toLocaleString("es-CL")}`,
    "- Ventas por mes (últimos 6 meses):",
    ...Object.entries(monthBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split("-").map(Number);
        return `  ${MONTH_NAMES[m]} ${y}: ${v.sales} ventas, $${v.revenue.toLocaleString("es-CL")} facturado`;
      }),
    "",
    "INVENTARIO",
    `- Total vehículos: ${totalVehicles}`,
    `- Disponibles: ${availableVehicles}`,
    "- Por categoría: " + Object.entries(byCategory).map(([c, n]) => `${c}: ${n}`).join(", ") || "N/A",
    "",
    "LEADS Y CRM",
    `- Leads activos: ${activeLeads}`,
    "- Leads por estado: " + Object.entries(leadsByStatus).map(([s, n]) => `${s}: ${n}`).join(", ") || "N/A",
    `- Citas programadas (próximas): ${scheduledAppointments}`,
    "",
    "FINANZAS",
    `- Ingresos totales (ventas + otros): $${totalIncome.toLocaleString("es-CL")}`,
    `- Gastos totales: $${totalExpenses.toLocaleString("es-CL")}`,
    `- Gastos esta semana: $${expensesThisWeek.toLocaleString("es-CL")}`,
    `- Balance: $${balance.toLocaleString("es-CL")}`,
    "- Gastos por tipo: " + Object.entries(expensesByCategory).map(([t, a]) => `${t}: $${a.toLocaleString("es-CL")}`).join(", ") || "N/A",
    "",
    "ÚLTIMAS VENTAS (hasta 5):",
    ...recentSalesArr.map(
      (s: any) =>
        `- ${s.vehicle_description || "Vehículo"} | $${Number(s.sale_price || 0).toLocaleString("es-CL")} | ${s.sale_date} | margen $${Number(s.margin || 0).toLocaleString("es-CL")}`
    ),
    "",
    "--- FIN MÉTRICAS ---",
  ];

  return lines.join("\n");
}

async function callOpenAI(
  apiKey: string,
  systemContent: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 800,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI response missing content");
  }
  return content.trim();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return jsonResponse(503, {
      ok: false,
      error: "OPENAI_API_KEY no configurada. Configura el secret en Supabase (Edge Functions).",
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const { message, branchId = null, history = [] } = body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return jsonResponse(400, { ok: false, error: "message is required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(500, { ok: false, error: "Supabase no configurado" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const context = await fetchBusinessContext(supabase, branchId ?? null);
    const systemContent = SYSTEM_PROMPT + "\n\n" + context;

    const trimmedHistory = history.slice(-MAX_HISTORY * 2);
    const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      { role: "system", content: systemContent },
      ...trimmedHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: message.trim() },
    ];

    const text = await callOpenAI(apiKey, systemContent, messages);
    return jsonResponse(200, { ok: true, text });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.error("[support-chat] error:", errMsg);
    return jsonResponse(500, { ok: false, error: errMsg });
  }
}
