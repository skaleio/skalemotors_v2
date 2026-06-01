/** Integración Vercel — proyecto vitrina (dominios custom, no registrar). */

export const VERCEL_APEX_IPV4 = "76.76.21.21";
export const VERCEL_WWW_CNAME = "cname.vercel-dns.com";

export type DnsRecord = {
  type: string;
  name: string;
  value: string;
  reason?: string;
};

export type VercelConfig = {
  token: string;
  projectId: string;
  teamId: string | null;
};

export type VercelProjectDomain = {
  name: string;
  verified: boolean;
  verification?: Array<{ type?: string; domain?: string; value?: string; reason?: string }>;
  error?: { code?: string; message?: string };
};

export function getVitrinaBaseDomain(): string {
  return (Deno.env.get("VITRINA_BASE_DOMAIN") ?? "skalemotors.cl").trim().toLowerCase();
}

export function getVercelConfig(): VercelConfig | null {
  const token = Deno.env.get("VERCEL_API_TOKEN")?.trim();
  const projectId = Deno.env.get("VERCEL_PROJECT_ID_VITRINA")?.trim();
  if (!token || !projectId) return null;
  const teamId = Deno.env.get("VERCEL_TEAM_ID")?.trim() || null;
  return { token, projectId, teamId };
}

function teamQuery(teamId: string | null, prefix = "?"): string {
  if (!teamId) return "";
  return `${prefix}teamId=${encodeURIComponent(teamId)}`;
}

async function parseVercelError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    const msg = (j as { error?: { message?: string }; message?: string }).error?.message
      ?? (j as { message?: string }).message;
    if (msg) return String(msg);
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`;
}

export async function vercelGetProjectDomain(
  cfg: VercelConfig,
  domain: string,
): Promise<{ ok: true; data: VercelProjectDomain } | { ok: false; error: string; status: number }> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(cfg.teamId)}`,
    { headers: { Authorization: `Bearer ${cfg.token}` } },
  );
  if (!res.ok) {
    return { ok: false, error: await parseVercelError(res), status: res.status };
  }
  const data = (await res.json()) as VercelProjectDomain;
  return { ok: true, data };
}

export async function vercelAddProjectDomain(
  cfg: VercelConfig,
  domain: string,
): Promise<{ ok: true; data: VercelProjectDomain } | { ok: false; error: string; status: number }> {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(cfg.projectId)}/domains${teamQuery(cfg.teamId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    },
  );
  if (!res.ok) {
    return { ok: false, error: await parseVercelError(res), status: res.status };
  }
  const data = (await res.json()) as VercelProjectDomain;
  return { ok: true, data };
}

export async function vercelRemoveProjectDomain(
  cfg: VercelConfig,
  domain: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(domain)}${teamQuery(cfg.teamId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${cfg.token}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    return { ok: false, error: await parseVercelError(res), status: res.status };
  }
  return { ok: true };
}

/** Registros DNS recomendados cuando Vercel no devuelve verification o en dev sin API. */
export function defaultDnsRecords(domain: string): DnsRecord[] {
  const host = domain.toLowerCase();
  if (host.startsWith("www.")) {
    return [{ type: "CNAME", name: "www", value: VERCEL_WWW_CNAME }];
  }
  return [
    { type: "A", name: "@", value: VERCEL_APEX_IPV4 },
    { type: "CNAME", name: "www", value: VERCEL_WWW_CNAME },
  ];
}

export function dnsFromVercelDomain(domain: string, data: VercelProjectDomain): DnsRecord[] {
  const verification = data.verification;
  if (Array.isArray(verification) && verification.length > 0) {
    const mapped = verification
      .filter((v) => v?.value)
      .map((v) => ({
        type: String(v.type ?? "TXT").toUpperCase(),
        name: String(v.domain ?? domain),
        value: String(v.value ?? ""),
        reason: v.reason,
      }));
    if (mapped.length > 0) return mapped;
  }
  return defaultDnsRecords(domain);
}

export function mapVercelToVerificationStatus(data: VercelProjectDomain): "pending" | "verified" | "error" {
  if (data.error?.code || data.error?.message) return "error";
  if (data.verified === true) return "verified";
  return "pending";
}
