/**
 * H8: legacy_protected solo aplica bypass cross-tenant si el email está en allowlist.
 * Configurable: LEGACY_BYPASS_EMAILS=hessen@test.io,owner@skalemotors.cl
 */
export function legacyBypassEmails(): string[] {
  const raw = Deno.env.get("LEGACY_BYPASS_EMAILS") ?? "hessen@test.io";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function allowsCrossTenantLegacyBypass(profile: {
  legacy_protected?: boolean | null;
  email?: string | null;
} | null | undefined): boolean {
  if (!profile?.legacy_protected) return false;
  const email = profile.email?.trim().toLowerCase();
  if (!email) return false;
  return legacyBypassEmails().includes(email);
}
