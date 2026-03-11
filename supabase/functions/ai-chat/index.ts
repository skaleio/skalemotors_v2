/// <reference path="../_shared/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_CHAT = 1024;
const TEMPERATURE_CHAT = 0.3;
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
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  feature?: string;
  branchId?: string | null;
};

function buildSystemPromptBase(branchName: string): string {
  const today = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Eres un asistente especializado en gestión de automotoras para Skale Motors. La sucursal activa es: ${branchName || "General"}. Fecha actual: ${today}.

Reglas:
- Responde siempre en español (chileno), de forma profesional y concisa.
- Usa ÚNICAMENTE los datos del contexto que te proporciono. Si no hay dato para algo, dilo claramente.
- Para montos en pesos chilenos usa formato legible (ej. $1.500.000 o 1,5 millones).
- Sé breve en respuestas cortas; desarrolla más si preguntan análisis o detalle.`;
}

async function fetchBusinessContext(
  supabase: ReturnType<typeof createClient>,
  branchId: string | null
): Promise<string> {
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

  const sales = (salesData ?? []) as any[];
  const vehicles = (vehiclesData ?? []) as any[];
  const leads = (leadsData ?? []) as any[];
  const appointmentsDataArr = (appointmentsData ?? []) as any[];
  const ingresosDataArr = (ingresosData ?? []) as any[];
  const gastos = (gastosData ?? []) as any[];
  const summaryArr = (summaryData ?? []) as any[];

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

  const lines: string[] = [
    "--- CONTEXTO DEL NEGOCIO ---",
    "",
    "INVENTARIO",
    `- Total vehículos: ${totalVehicles}. Disponibles: ${availableVehicles}.`,
    vehicles.length > 0
      ? "- Ejemplos (marca, modelo, año, precio, estado): " +
        vehicles.slice(0, 8).map((v: any) => `${v.make} ${v.model} ${v.year} $${Number(v.price || 0).toLocaleString("es-CL")} (${v.status})`).join("; ")
      : "",
    "",
    "VENTAS Y FINANZAS",
    `- Ventas este mes: ${salesThisMonth}. Ingresos por ventas este mes: $${salesRevenueThisMonth.toLocaleString("es-CL")}.`,
    `- Ingresos totales (ingresos_empresa): $${totalIncome.toLocaleString("es-CL")}. Gastos totales: $${totalExpenses.toLocaleString("es-CL")}. Balance: $${balance.toLocaleString("es-CL")}.`,
    summaryArr.length > 0
      ? "- Resúmenes de cierre: " +
        summaryArr.map((s: any) => `${s.year}-${s.month}: ingreso $${Number(s.total_income || 0).toLocaleString("es-CL")}, gastos $${Number(s.total_expenses || 0).toLocaleString("es-CL")}, balance $${Number(s.balance || 0).toLocaleString("es-CL")}`).join("; ")
      : "",
    "",
    "LEADS Y CITAS",
    `- Leads activos: ${activeLeads}. Citas programadas (próximas): ${scheduledAppointments}.`,
    "",
    "--- FIN CONTEXTO ---",
  ];

  return lines.filter(Boolean).join("\n");
}

async function callAnthropic(
  apiKey: string,
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS_CHAT,
      temperature: TEMPERATURE_CHAT,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const block = data?.content?.find((b) => b.type === "text");
  const text = block?.text;
  if (typeof text !== "string") {
    throw new Error("Anthropic response missing content");
  }
  return text.trim();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse(503, {
      ok: false,
      error: "ANTHROPIC_API_KEY no configurada. Configura el secret en Supabase (Edge Functions).",
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const { message, conversationHistory = [], branchId = null } = body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return jsonResponse(400, { ok: false, error: "message is required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse(500, { ok: false, error: "Supabase no configurado" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let branchName = "General";
  if (branchId) {
    const { data: branch } = await supabase.from("branches").select("name").eq("id", branchId).maybeSingle();
    if (branch?.name) branchName = branch.name;
  }

  try {
    const context = await fetchBusinessContext(supabase, branchId ?? null);
    const systemBase = buildSystemPromptBase(branchName);
    const systemContent = systemBase + "\n\n" + context;

    const trimmedHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message.trim() },
    ];

    const text = await callAnthropic(apiKey, systemContent, messages);
    return jsonResponse(200, { ok: true, text });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    console.error("[ai-chat] error:", errMsg);
    return jsonResponse(500, { ok: false, error: errMsg });
  }
}
