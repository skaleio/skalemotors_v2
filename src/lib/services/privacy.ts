import { supabase } from "@/lib/supabase";

export type PrivacyPolicyVersion = {
  id: string;
  version: string;
  title: string;
  body_url: string | null;
  effective_at: string;
};

export async function getCurrentPrivacyPolicy(): Promise<PrivacyPolicyVersion | null> {
  const { data, error } = await supabase
    .from("privacy_policy_versions")
    .select("id, version, title, body_url, effective_at")
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function acceptPrivacyPolicy(policyVersionId: string, tenantId: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión requerida");
  const { error } = await supabase.from("user_privacy_acceptances").upsert(
    {
      user_id: user.id,
      tenant_id: tenantId,
      policy_version_id: policyVersionId,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,policy_version_id" },
  );
  if (error) throw error;
}

export async function hasAcceptedCurrentPolicy(policyVersionId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("user_privacy_acceptances")
    .select("id")
    .eq("user_id", user.id)
    .eq("policy_version_id", policyVersionId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function requestDataSubjectAccess(
  subjectType: "lead" | "user",
  subjectId: string,
  requestType: "access" | "rectification" | "deletion" | "portability",
  notes?: string,
): Promise<void> {
  const { error } = await supabase.from("data_subject_requests").insert({
    subject_type: subjectType,
    subject_id: subjectId,
    request_type: requestType,
    notes: notes ?? null,
    status: "pending",
  });
  if (error) throw error;
}

export async function exportTenantDataBundle(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("export_tenant_data_bundle");
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

export async function getTenantAiBudget(): Promise<{
  allowed: boolean;
  spent_usd?: number;
  budget_usd?: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: true };
  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profile?.tenant_id) return { allowed: true };
  const { data, error } = await supabase.rpc("check_tenant_ai_budget", {
    p_tenant_id: profile.tenant_id,
  });
  if (error) throw error;
  const row = data as { allowed?: boolean; spent_usd?: number; budget_usd?: number };
  return {
    allowed: row.allowed !== false,
    spent_usd: row.spent_usd,
    budget_usd: row.budget_usd,
  };
}
