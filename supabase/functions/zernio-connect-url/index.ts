import { corsHeaders } from "../_shared/cors.ts";
import { requireZernioAuth } from "../_shared/zernioAuth.ts";
import { zernioFetch } from "../_shared/zernioClient.ts";
import { resolveZernioProfileId } from "../_shared/zernioProfiles.ts";
import { canAccessScope, canConnectOrg, type ZernioScope } from "../_shared/zernioRbac.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ConnectBody = {
  scope?: ZernioScope;
  platform?: string;
  redirect_url?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const auth = await requireZernioAuth(req);
  if (auth instanceof Response) return auth;

  let body: ConnectBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "JSON inválido" });
  }

  const scope = body.scope === "org" ? "org" : body.scope === "personal" ? "personal" : null;
  const platform = (body.platform ?? "").trim().toLowerCase();
  if (!scope) return jsonResponse(400, { ok: false, error: "scope debe ser org o personal" });
  if (!platform) return jsonResponse(400, { ok: false, error: "platform es requerido" });

  if (scope === "org" && !canConnectOrg(auth.role)) {
    return jsonResponse(403, { ok: false, error: "No tienes permiso para conectar cuentas de la automotora" });
  }
  if (!canAccessScope(scope, auth.role)) {
    return jsonResponse(403, { ok: false, error: "Sin permiso para este ámbito" });
  }

  try {
    const { data: tenant } = await auth.admin
      .from("tenants")
      .select("name")
      .eq("id", auth.tenantId)
      .maybeSingle();

    const { data: userRow } = await auth.admin
      .from("users")
      .select("full_name, email")
      .eq("id", auth.userId)
      .maybeSingle();

    const profileId = await resolveZernioProfileId(
      auth.admin,
      auth.tenantId,
      auth.userId,
      scope,
      tenant?.name ?? "Automotora",
      userRow?.full_name ?? userRow?.email ?? "Usuario",
    );

    const redirectUrl = (body.redirect_url ?? "").trim();
    if (!redirectUrl) {
      return jsonResponse(400, { ok: false, error: "redirect_url es requerido" });
    }
    try {
      new URL(redirectUrl);
    } catch {
      return jsonResponse(400, { ok: false, error: "redirect_url inválido" });
    }

    const connect = await zernioFetch<{ authUrl?: string; auth_url?: string }>(
      `/connect/${encodeURIComponent(platform)}?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(redirectUrl)}`,
    );

    const authUrl = connect.authUrl ?? connect.auth_url;
    if (!authUrl) {
      return jsonResponse(502, { ok: false, error: "Zernio no devolvió URL de conexión" });
    }

    return jsonResponse(200, { ok: true, authUrl, scope, platform });
  } catch (e) {
    return jsonResponse(500, { ok: false, error: (e as Error).message });
  }
}
