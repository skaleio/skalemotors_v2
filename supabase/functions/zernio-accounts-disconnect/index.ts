import { corsHeaders } from "../_shared/cors.ts";
import { requireZernioAuth } from "../_shared/zernioAuth.ts";
import { canAccessScope, canMutateOrgAccounts, type ZernioScope } from "../_shared/zernioRbac.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type DisconnectBody = {
  scope?: ZernioScope;
  zernio_account_id?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const auth = await requireZernioAuth(req);
  if (auth instanceof Response) return auth;

  let body: DisconnectBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "JSON inválido" });
  }

  const scope = body.scope === "org" ? "org" : body.scope === "personal" ? "personal" : null;
  const zernioAccountId = (body.zernio_account_id ?? "").trim();
  if (!scope) return jsonResponse(400, { ok: false, error: "scope debe ser org o personal" });
  if (!zernioAccountId) return jsonResponse(400, { ok: false, error: "zernio_account_id es requerido" });

  if (scope === "org" && !canMutateOrgAccounts(auth.role)) {
    return jsonResponse(403, { ok: false, error: "No puedes desconectar cuentas de la automotora" });
  }
  if (!canAccessScope(scope, auth.role)) {
    return jsonResponse(403, { ok: false, error: "Sin permiso para este ámbito" });
  }

  let query = auth.admin
    .from("zernio_accounts")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("tenant_id", auth.tenantId)
    .eq("scope", scope)
    .eq("zernio_account_id", zernioAccountId);

  if (scope === "personal") {
    query = query.eq("user_id", auth.userId);
  }

  const { data, error } = await query.select("id");
  if (error) return jsonResponse(500, { ok: false, error: error.message });
  if (!data?.length) return jsonResponse(404, { ok: false, error: "Cuenta no encontrada" });

  return jsonResponse(200, { ok: true });
}
