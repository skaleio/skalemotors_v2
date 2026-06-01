import { corsHeaders } from "../_shared/cors.ts";
import { requireZernioAuth } from "../_shared/zernioAuth.ts";
import { zernioFetch } from "../_shared/zernioClient.ts";
import { resolveZernioProfileId } from "../_shared/zernioProfiles.ts";
import { canAccessScope, type ZernioScope } from "../_shared/zernioRbac.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SyncBody = { scope?: ZernioScope };

type ZernioAccount = {
  _id: string;
  platform: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const auth = await requireZernioAuth(req);
  if (auth instanceof Response) return auth;

  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "JSON inválido" });
  }

  const scope = body.scope === "org" ? "org" : body.scope === "personal" ? "personal" : null;
  if (!scope) return jsonResponse(400, { ok: false, error: "scope debe ser org o personal" });
  if (!canAccessScope(scope, auth.role)) {
    return jsonResponse(403, { ok: false, error: "Sin permiso para este ámbito" });
  }

  try {
    const { data: tenant } = await auth.admin.from("tenants").select("name").eq("id", auth.tenantId).maybeSingle();
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

    const listed = await zernioFetch<{ accounts?: ZernioAccount[] }>("/accounts");
    const accounts = (listed.accounts ?? []).filter((a) => a._id);

    const rows = accounts.map((acc) => ({
      tenant_id: auth.tenantId,
      scope,
      user_id: scope === "personal" ? auth.userId : null,
      zernio_account_id: acc._id,
      platform: acc.platform,
      display_name: acc.displayName ?? null,
      username: acc.username ?? null,
      avatar_url: acc.avatarUrl ?? null,
      status: "active",
      last_error: null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error } = await auth.admin.from("zernio_accounts").upsert(rows, {
        onConflict: "tenant_id,scope,zernio_account_id",
      });
      if (error) return jsonResponse(500, { ok: false, error: error.message });
    }

    return jsonResponse(200, {
      ok: true,
      synced: rows.length,
      profileId,
      scope,
    });
  } catch (e) {
    return jsonResponse(500, { ok: false, error: (e as Error).message });
  }
}
