import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/authGuard.ts";
import { assertCanManageWhatsAppBranch, findActiveInboxForBranch } from "../_shared/whatsappInbox.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PROJECT_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
  }

  const auth = await requireAuth(req, supabaseUrl, serviceRoleKey);
  if (!auth.ok) return auth.response;

  let body: { branch_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const branchId = (body.branch_id ?? "").trim();
  if (!branchId) return jsonResponse(400, { ok: false, error: "branch_id is required" });

  const perm = await assertCanManageWhatsAppBranch(auth.ctx, branchId);
  if (!perm.ok) return jsonResponse(perm.status, { ok: false, error: perm.error });

  const admin = auth.ctx.supabase;
  const inbox = await findActiveInboxForBranch(admin, branchId);

  if (!inbox) {
    return jsonResponse(200, { ok: true, message: "WhatsApp ya estaba desconectado" });
  }

  await admin.from("whatsapp_inbox_credentials").delete().eq("inbox_id", inbox.id);

  const { error: updErr } = await admin
    .from("whatsapp_inboxes")
    .update({
      is_active: false,
      status: "disconnected",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", inbox.id);

  if (updErr) {
    return jsonResponse(500, { ok: false, error: updErr.message });
  }

  return jsonResponse(200, { ok: true, message: "WhatsApp desconectado" });
}

Deno.serve((req) => handler(req));
