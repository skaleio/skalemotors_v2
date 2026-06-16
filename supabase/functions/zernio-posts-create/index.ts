import { requireZernioAuth } from "../_shared/zernioAuth.ts";
import { zernioFetch } from "../_shared/zernioClient.ts";
import { zernioJson, zernioOptions } from "../_shared/zernioHttp.ts";
import { canAccessScope, canPublishOrg, type ZernioScope } from "../_shared/zernioRbac.ts";

type PlatformTarget = { platform: string; accountId: string };

type CreatePostBody = {
  scope?: ZernioScope;
  content?: string;
  platforms?: PlatformTarget[];
  publish_now?: boolean;
  scheduled_for?: string;
  timezone?: string;
  media_urls?: string[];
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return zernioOptions(req);
  if (req.method !== "POST") return zernioJson(req, 405, { ok: false, error: "Method not allowed" });

  const auth = await requireZernioAuth(req);
  if (auth instanceof Response) return auth;

  let body: CreatePostBody;
  try {
    body = await req.json();
  } catch {
    return zernioJson(req, 400, { ok: false, error: "JSON inválido" });
  }

  const scope = body.scope === "org" ? "org" : body.scope === "personal" ? "personal" : null;
  const content = (body.content ?? "").trim();
  const platforms = body.platforms ?? [];
  const publishNow = body.publish_now === true;
  const scheduledFor = (body.scheduled_for ?? "").trim() || null;
  const timezone = (body.timezone ?? "America/Santiago").trim();
  const mediaUrls = Array.isArray(body.media_urls) ? body.media_urls.filter(Boolean) : [];

  if (!scope) return zernioJson(req, 400, { ok: false, error: "scope debe ser org o personal" });
  if (!content) return zernioJson(req, 400, { ok: false, error: "El contenido es requerido" });
  if (!platforms.length) return zernioJson(req, 400, { ok: false, error: "Selecciona al menos una cuenta" });

  if (scope === "org" && !canPublishOrg(auth.role)) {
    return zernioJson(req, 403, { ok: false, error: "No puedes publicar en cuentas de la automotora" });
  }
  if (!canAccessScope(scope, auth.role)) {
    return zernioJson(req, 403, { ok: false, error: "Sin permiso para este ámbito" });
  }

  const accountIds = platforms.map((p) => p.accountId);
  let accountsQuery = auth.admin
    .from("zernio_accounts")
    .select("zernio_account_id, platform, scope, user_id, status")
    .eq("tenant_id", auth.tenantId)
    .eq("scope", scope)
    .eq("status", "active")
    .in("zernio_account_id", accountIds);

  if (scope === "personal") {
    accountsQuery = accountsQuery.eq("user_id", auth.userId);
  }

  const { data: allowedAccounts, error: accErr } = await accountsQuery;
  if (accErr) return zernioJson(req, 500, { ok: false, error: accErr.message });
  if (!allowedAccounts?.length || allowedAccounts.length !== accountIds.length) {
    return zernioJson(req, 403, { ok: false, error: "Una o más cuentas no están autorizadas" });
  }

  const zernioPlatforms = platforms.map((p) => ({
    platform: p.platform,
    accountId: p.accountId,
  }));

  const localStatus = publishNow ? "publishing" : scheduledFor ? "scheduled" : "draft";

  const { data: localRow, error: insertErr } = await auth.admin
    .from("zernio_posts")
    .insert({
      tenant_id: auth.tenantId,
      scope,
      created_by: auth.userId,
      content,
      media_urls: mediaUrls,
      platforms: zernioPlatforms,
      scheduled_for: scheduledFor,
      timezone,
      status: localStatus,
    })
    .select("id")
    .single();

  if (insertErr) return zernioJson(req, 500, { ok: false, error: insertErr.message });

  try {
    const zernioBody: Record<string, unknown> = {
      content,
      platforms: zernioPlatforms,
      timezone,
    };
    if (mediaUrls.length) zernioBody.mediaUrls = mediaUrls;
    if (publishNow) {
      zernioBody.publishNow = true;
    } else if (scheduledFor) {
      zernioBody.scheduledFor = scheduledFor;
    }

    const created = await zernioFetch<{ post?: { _id?: string }; _id?: string }>("/posts", {
      method: "POST",
      body: zernioBody,
    });

    const zernioPostId = created.post?._id ?? created._id ?? null;
    const finalStatus = publishNow ? "published" : scheduledFor ? "scheduled" : "draft";

    await auth.admin
      .from("zernio_posts")
      .update({
        zernio_post_id: zernioPostId,
        status: finalStatus,
        published_at: publishNow ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localRow.id);

    return zernioJson(req, 200, {
      ok: true,
      post_id: localRow.id,
      zernio_post_id: zernioPostId,
      status: finalStatus,
    });
  } catch (e) {
    await auth.admin
      .from("zernio_posts")
      .update({
        status: "failed",
        last_error: (e as Error).message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localRow.id);

    return zernioJson(req, 500, { ok: false, error: (e as Error).message });
  }
}

Deno.serve((req) => handler(req));
