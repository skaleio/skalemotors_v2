import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnvAny(names: string[]): string | null {
  for (const name of names) {
    const v = Deno.env.get(name);
    if (v) return v;
  }
  return null;
}

function getApiKey(req: Request): string {
  return (
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(req.url).searchParams.get("api_key") ||
    ""
  );
}

const PRIORITIES = ["urgent", "today", "later"] as const;
const ACTION_TYPES = ["contactar", "llamar", "confirmar", "enviar_cotizacion", "otro"] as const;
const ENTITY_TYPES = ["lead", "appointment", "custom"] as const;
const SOURCES = ["rule", "llm", "whatsapp"] as const;

type Payload = {
  branch_id: string;
  assigned_to?: string | null;
  priority?: string;
  title: string;
  description?: string | null;
  action_type?: string;
  action_label?: string | null;
  entity_type?: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  source?: string;
  due_at?: string | null;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const expectedKey = Deno.env.get("PENDING_TASK_API_KEY");
  if (expectedKey) {
    const provided = getApiKey(req);
    if (!provided || !provided.includes(expectedKey)) {
      return jsonResponse(401, { ok: false, error: "Invalid API key" });
    }
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const branchId = body.branch_id?.trim();
  const title = body.title?.trim();
  if (!branchId || !title) {
    return jsonResponse(400, { ok: false, error: "branch_id and title are required" });
  }

  const priority = body.priority && PRIORITIES.includes(body.priority as typeof PRIORITIES[number])
    ? body.priority
    : "today";
  const actionType = body.action_type && ACTION_TYPES.includes(body.action_type as typeof ACTION_TYPES[number])
    ? body.action_type
    : "otro";
  const entityType = body.entity_type && ENTITY_TYPES.includes(body.entity_type as typeof ENTITY_TYPES[number])
    ? body.entity_type
    : "custom";
  const source = body.source && SOURCES.includes(body.source as typeof SOURCES[number])
    ? body.source
    : "whatsapp";

  const supabaseUrl = getEnvAny(["SUPABASE_URL", "PROJECT_URL"]);
  const serviceRoleKey = getEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const insertPayload = {
    branch_id: branchId,
    assigned_to: body.assigned_to?.trim() || null,
    priority,
    title,
    description: body.description?.trim() || null,
    action_type: actionType,
    action_label: body.action_label?.trim() || "Ver",
    entity_type: entityType,
    entity_id: body.entity_id?.trim() || null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    source,
    due_at: body.due_at?.trim() || null,
  };

  const { data, error } = await supabase
    .from("pending_tasks")
    .insert(insertPayload)
    .select("id, title, priority, action_type, entity_type, entity_id, created_at")
    .single();

  if (error) {
    return jsonResponse(400, { ok: false, error: error.message });
  }

  return jsonResponse(200, { ok: true, data });
}
