import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthContext = {
  supabase: SupabaseClient;
  user: User;
  tenantId: string | null;
  legacyProtected: boolean;
  role: string | null;
};

export async function requireAuth(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ ok: true; ctx: AuthContext } | { ok: false; response: Response; corsHeaders: Record<string, string> }> {
  const { corsHeaders } = await import("./cors.ts");

  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return {
      ok: false,
      corsHeaders,
      response: new Response(JSON.stringify({ ok: false, error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) {
    return {
      ok: false,
      corsHeaders,
      response: new Response(JSON.stringify({ ok: false, error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, legacy_protected, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    return {
      ok: false,
      corsHeaders,
      response: new Response(JSON.stringify({ ok: false, error: "Account disabled" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  if (profile.tenant_id) {
    const { data: operational } = await supabase.rpc("tenant_is_operational", {
      p_tenant_id: profile.tenant_id,
    });
    if (operational === false) {
      return {
        ok: false,
        corsHeaders,
        response: new Response(JSON.stringify({
          ok: false,
          error: "Tenant suspendido o dado de baja. Contactá a soporte.",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
      };
    }
  }

  return {
    ok: true,
    ctx: {
      supabase,
      user,
      tenantId: profile.tenant_id ?? null,
      legacyProtected: Boolean(profile.legacy_protected),
      role: profile.role ?? null,
    },
  };
}

export async function assertBranchInTenant(
  supabase: SupabaseClient,
  branchId: string,
  tenantId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}
