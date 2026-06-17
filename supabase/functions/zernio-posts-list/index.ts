import { requireZernioAuth } from "../_shared/zernioAuth.ts";
import { zernioJson, zernioOptions } from "../_shared/zernioHttp.ts";
import { canAccessScope, type ZernioScope } from "../_shared/zernioRbac.ts";

type ListBody = { scope?: ZernioScope; limit?: number };

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return zernioOptions(req);
  if (req.method !== "POST") return zernioJson(req, 405, { ok: false, error: "Method not allowed" });

  const auth = await requireZernioAuth(req);
  if (auth instanceof Response) return auth;

  let body: ListBody = {};
  try {
    body = await req.json();
  } catch {
    return zernioJson(req, 400, { ok: false, error: "JSON inválido" });
  }

  const scope = body.scope === "org" ? "org" : body.scope === "personal" ? "personal" : null;
  const limit = Math.min(Math.max(body.limit ?? 20, 1), 50);
  if (!scope) return zernioJson(req, 400, { ok: false, error: "scope debe ser org o personal" });
  if (!canAccessScope(scope, auth.role)) {
    return zernioJson(req, 403, { ok: false, error: "Sin permiso para este ámbito" });
  }

  let query = auth.admin
    .from("zernio_posts")
    .select(
      "id, scope, content, platforms, media_urls, scheduled_for, status, zernio_post_id, published_at, created_at, created_by",
    )
    .eq("tenant_id", auth.tenantId)
    .eq("scope", scope)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (scope === "personal") {
    query = query.eq("created_by", auth.userId);
  }

  const { data, error } = await query;
  if (error) return zernioJson(req, 500, { ok: false, error: error.message });

  return zernioJson(req, 200, { ok: true, posts: data ?? [] });
}

Deno.serve((req) => handler(req));
