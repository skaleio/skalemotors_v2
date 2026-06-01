// vitrina-domain — gestión de dominios de vitrina (subdominio + custom vía Vercel).
// Auth: JWT + rol gerente/admin/jefe_jefe. Nunca confiar en tenant_id del body.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/authGuard.ts";
import {
  defaultDnsRecords,
  dnsFromVercelDomain,
  getVercelConfig,
  getVitrinaBaseDomain,
  mapVercelToVerificationStatus,
  vercelAddProjectDomain,
  vercelGetProjectDomain,
  vercelRemoveProjectDomain,
  type DnsRecord,
} from "../_shared/vercelVitrina.ts";

const MANAGE_ROLES = new Set(["admin", "gerente", "jefe_jefe"]);

type Action =
  | "provision_subdomain"
  | "add"
  | "verify"
  | "remove"
  | "set_primary"
  | "status";

type Body = {
  action?: Action;
  domain?: string;
  domain_id?: string;
};

function json(cors: Record<string, string>, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

function normalizeHostname(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (!s || s.includes("/") || s.includes(" ") || !s.includes(".")) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) {
    return null;
  }
  return s;
}

function assertManageRole(role: string | null): boolean {
  return Boolean(role && MANAGE_ROLES.has(role));
}

function isSubdomainOfBase(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`);
}

async function loadDomainRow(
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  domainId: string,
  tenantId: string,
) {
  const { data, error } = await supabase
    .from("tenant_domains")
    .select("*")
    .eq("id", domainId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function clearPrimaryForTenant(
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  tenantId: string,
) {
  await supabase
    .from("tenant_domains")
    .update({ is_primary: false })
    .eq("tenant_id", tenantId)
    .eq("is_primary", true);
}

export default async function handler(req: Request): Promise<Response> {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(cors, 405, { ok: false, error: "Method not allowed" });

  const supabaseUrl = getEnv("SUPABASE_URL") ?? getEnv("PROJECT_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(cors, 500, { ok: false, error: "Missing Supabase env vars" });
  }

  const auth = await requireAuth(req, supabaseUrl, serviceRoleKey);
  if (!auth.ok) return auth.response;

  const { ctx } = auth;
  if (!ctx.tenantId) {
    return json(cors, 403, { ok: false, error: "Usuario sin tenant asignado" });
  }
  if (!assertManageRole(ctx.role) && !ctx.legacyProtected) {
    return json(cors, 403, { ok: false, error: "Sin permiso para gestionar dominios" });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(cors, 400, { ok: false, error: "JSON inválido" });
  }

  const action = body.action;
  if (!action) return json(cors, 400, { ok: false, error: "action es requerida" });

  const baseDomain = getVitrinaBaseDomain();
  const vercel = getVercelConfig();

  try {
    switch (action) {
      case "provision_subdomain": {
        const { data: tenant, error: tenantErr } = await ctx.supabase
          .from("tenants")
          .select("id, slug")
          .eq("id", ctx.tenantId)
          .maybeSingle();
        if (tenantErr || !tenant?.slug) {
          return json(cors, 400, { ok: false, error: "No se pudo resolver el slug del tenant" });
        }

        const subdomain = `${tenant.slug}.${baseDomain}`;
        const { data: existing } = await ctx.supabase
          .from("tenant_domains")
          .select("*")
          .eq("tenant_id", ctx.tenantId)
          .eq("domain", subdomain)
          .maybeSingle();

        if (existing) {
          return json(cors, 200, {
            ok: true,
            domain: existing,
            dns_records: [],
            message: "Subdominio ya provisionado",
          });
        }

        const { data: conflict } = await ctx.supabase
          .from("tenant_domains")
          .select("id, tenant_id")
          .eq("domain", subdomain)
          .maybeSingle();
        if (conflict && conflict.tenant_id !== ctx.tenantId) {
          return json(cors, 409, { ok: false, error: "El subdominio ya está en uso por otro tenant" });
        }

        await clearPrimaryForTenant(ctx.supabase, ctx.tenantId);

        const { data: inserted, error: insErr } = await ctx.supabase
          .from("tenant_domains")
          .insert({
            tenant_id: ctx.tenantId,
            domain: subdomain,
            kind: "subdomain",
            is_primary: true,
            verification_status: "verified",
            vercel_domain_id: null,
          })
          .select()
          .single();
        if (insErr) return json(cors, 500, { ok: false, error: insErr.message });

        return json(cors, 200, {
          ok: true,
          domain: inserted,
          dns_records: [],
          message: `Subdominio listo: ${subdomain}`,
        });
      }

      case "add": {
        const host = normalizeHostname(body.domain ?? "");
        if (!host) return json(cors, 400, { ok: false, error: "Dominio inválido" });

        if (isSubdomainOfBase(host, baseDomain)) {
          return json(cors, 400, {
            ok: false,
            error: `Usá la acción provision_subdomain para *.${baseDomain}`,
          });
        }

        const { data: taken } = await ctx.supabase
          .from("tenant_domains")
          .select("tenant_id")
          .eq("domain", host)
          .maybeSingle();
        if (taken && taken.tenant_id !== ctx.tenantId) {
          return json(cors, 409, { ok: false, error: "Ese dominio ya está registrado en otra automotora" });
        }

        let dnsRecords: DnsRecord[] = defaultDnsRecords(host);
        let vercelDomainId: string | null = host;
        let verificationStatus: "pending" | "verified" | "error" = "pending";

        if (vercel) {
          const added = await vercelAddProjectDomain(vercel, host);
          if (!added.ok) {
            if (added.status === 409) {
              const got = await vercelGetProjectDomain(vercel, host);
              if (got.ok) {
                dnsRecords = dnsFromVercelDomain(host, got.data);
                verificationStatus = mapVercelToVerificationStatus(got.data);
              }
            } else {
              return json(cors, 502, { ok: false, error: `Vercel: ${added.error}` });
            }
          } else {
            dnsRecords = dnsFromVercelDomain(host, added.data);
            verificationStatus = mapVercelToVerificationStatus(added.data);
          }
        }

        if (taken) {
          const { data: updated, error: upErr } = await ctx.supabase
            .from("tenant_domains")
            .update({
              kind: "custom",
              verification_status: verificationStatus,
              vercel_domain_id: vercelDomainId,
            })
            .eq("domain", host)
            .eq("tenant_id", ctx.tenantId)
            .select()
            .single();
          if (upErr) return json(cors, 500, { ok: false, error: upErr.message });
          return json(cors, 200, { ok: true, domain: updated, dns_records: dnsRecords });
        }

        const { count } = await ctx.supabase
          .from("tenant_domains")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", ctx.tenantId);
        const makePrimary = (count ?? 0) === 0;

        const { data: inserted, error: insErr } = await ctx.supabase
          .from("tenant_domains")
          .insert({
            tenant_id: ctx.tenantId,
            domain: host,
            kind: "custom",
            is_primary: makePrimary,
            verification_status: verificationStatus,
            vercel_domain_id: vercelDomainId,
          })
          .select()
          .single();
        if (insErr) return json(cors, 500, { ok: false, error: insErr.message });

        return json(cors, 200, {
          ok: true,
          domain: inserted,
          dns_records: dnsRecords,
          vercel_configured: Boolean(vercel),
        });
      }

      case "verify":
      case "status": {
        const domainId = (body.domain_id ?? "").trim();
        if (!domainId) return json(cors, 400, { ok: false, error: "domain_id es requerido" });

        const row = await loadDomainRow(ctx.supabase, domainId, ctx.tenantId);
        if (!row) return json(cors, 404, { ok: false, error: "Dominio no encontrado" });

        if (row.kind === "subdomain") {
          return json(cors, 200, {
            ok: true,
            domain: row,
            dns_records: [],
            verification_status: row.verification_status,
          });
        }

        let dnsRecords: DnsRecord[] = defaultDnsRecords(row.domain);
        let verificationStatus = row.verification_status as "pending" | "verified" | "error";

        if (vercel) {
          const got = await vercelGetProjectDomain(vercel, row.domain);
          if (got.ok) {
            dnsRecords = dnsFromVercelDomain(row.domain, got.data);
            verificationStatus = mapVercelToVerificationStatus(got.data);
          } else if (got.status !== 404) {
            verificationStatus = "error";
          }
        }

        const { data: updated, error: upErr } = await ctx.supabase
          .from("tenant_domains")
          .update({ verification_status: verificationStatus })
          .eq("id", row.id)
          .select()
          .single();
        if (upErr) return json(cors, 500, { ok: false, error: upErr.message });

        return json(cors, 200, {
          ok: true,
          domain: updated ?? row,
          dns_records: dnsRecords,
          vercel_configured: Boolean(vercel),
        });
      }

      case "set_primary": {
        const domainId = (body.domain_id ?? "").trim();
        if (!domainId) return json(cors, 400, { ok: false, error: "domain_id es requerido" });

        const row = await loadDomainRow(ctx.supabase, domainId, ctx.tenantId);
        if (!row) return json(cors, 404, { ok: false, error: "Dominio no encontrado" });
        if (row.verification_status !== "verified") {
          return json(cors, 400, {
            ok: false,
            error: "Solo podés marcar como principal un dominio verificado",
          });
        }

        await clearPrimaryForTenant(ctx.supabase, ctx.tenantId);
        const { data: updated, error: upErr } = await ctx.supabase
          .from("tenant_domains")
          .update({ is_primary: true })
          .eq("id", row.id)
          .select()
          .single();
        if (upErr) return json(cors, 500, { ok: false, error: upErr.message });

        return json(cors, 200, { ok: true, domain: updated });
      }

      case "remove": {
        const domainId = (body.domain_id ?? "").trim();
        if (!domainId) return json(cors, 400, { ok: false, error: "domain_id es requerido" });

        const row = await loadDomainRow(ctx.supabase, domainId, ctx.tenantId);
        if (!row) return json(cors, 404, { ok: false, error: "Dominio no encontrado" });

        if (row.kind === "custom" && vercel) {
          const removed = await vercelRemoveProjectDomain(vercel, row.domain);
          if (!removed.ok) {
            return json(cors, 502, { ok: false, error: `Vercel: ${removed.error}` });
          }
        }

        const { error: delErr } = await ctx.supabase.from("tenant_domains").delete().eq("id", row.id);
        if (delErr) return json(cors, 500, { ok: false, error: delErr.message });

        if (row.is_primary) {
          const { data: next } = await ctx.supabase
            .from("tenant_domains")
            .select("id")
            .eq("tenant_id", ctx.tenantId)
            .eq("verification_status", "verified")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (next?.id) {
            await ctx.supabase.from("tenant_domains").update({ is_primary: true }).eq("id", next.id);
          }
        }

        return json(cors, 200, { ok: true, removed_domain: row.domain });
      }

      default:
        return json(cors, 400, { ok: false, error: `Acción desconocida: ${action}` });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    return json(cors, 500, { ok: false, error: msg });
  }
}
