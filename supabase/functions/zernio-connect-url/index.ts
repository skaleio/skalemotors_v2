import { requireZernioAuth } from "../_shared/zernioAuth.ts";
import { zernioFetch } from "../_shared/zernioClient.ts";
import { zernioJson, zernioOptions } from "../_shared/zernioHttp.ts";
import { resolveZernioProfileId } from "../_shared/zernioProfiles.ts";
import { canAccessScope, canConnectOrg, type ZernioScope } from "../_shared/zernioRbac.ts";

type ConnectBody = {
  scope?: ZernioScope;
  platform?: string;
  redirect_url?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return zernioOptions(req);
  if (req.method !== "POST") return zernioJson(req, 405, { ok: false, error: "Method not allowed" });

  const auth = await requireZernioAuth(req);
  if (auth instanceof Response) return auth;

  let body: ConnectBody;
  try {
    body = await req.json();
  } catch {
    return zernioJson(req, 400, { ok: false, error: "JSON inválido" });
  }

  const scope = body.scope === "org" ? "org" : body.scope === "personal" ? "personal" : null;
  const platform = (body.platform ?? "").trim().toLowerCase();
  if (!scope) return zernioJson(req, 400, { ok: false, error: "scope debe ser org o personal" });
  if (!platform) return zernioJson(req, 400, { ok: false, error: "platform es requerido" });

  if (scope === "org" && !canConnectOrg(auth.role)) {
    return zernioJson(req, 403, { ok: false, error: "No tienes permiso para conectar cuentas de la automotora" });
  }
  if (!canAccessScope(scope, auth.role)) {
    return zernioJson(req, 403, { ok: false, error: "Sin permiso para este ámbito" });
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
      return zernioJson(req, 400, { ok: false, error: "redirect_url es requerido" });
    }
    try {
      new URL(redirectUrl);
    } catch {
      return zernioJson(req, 400, { ok: false, error: "redirect_url inválido" });
    }

    const connectPath =
      `/connect/${encodeURIComponent(platform)}?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    const connect = await zernioFetch<Record<string, unknown>>(connectPath);

    let authUrl: string | null = null;
    if (typeof connect.authUrl === "string") authUrl = connect.authUrl;
    else if (typeof connect.auth_url === "string") authUrl = connect.auth_url;
    else if (typeof connect.url === "string") authUrl = connect.url;
    else if (connect.data && typeof connect.data === "object") {
      const nested = connect.data as Record<string, unknown>;
      if (typeof nested.authUrl === "string") authUrl = nested.authUrl;
      else if (typeof nested.auth_url === "string") authUrl = nested.auth_url;
    }

    if (!authUrl) {
      return zernioJson(req, 502, { ok: false, error: "Zernio no devolvió URL de conexión" });
    }

    return zernioJson(req, 200, { ok: true, authUrl, scope, platform });
  } catch (e) {
    return zernioJson(req, 500, { ok: false, error: (e as Error).message });
  }
}
