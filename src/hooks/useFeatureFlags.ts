import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

/** Claves alineadas con `tenant_feature_flags.flag_key` y variables VITE_FLAG_* */
export type TenantFlagKey =
  | "investor_ready_security"
  | "tenant_rbac"
  | "automated_provisioning"
  | "strict_finance_access";

const ENV_FLAG_BY_KEY: Record<TenantFlagKey, string> = {
  investor_ready_security: "VITE_FLAG_INVESTOR_READY_SECURITY",
  tenant_rbac: "VITE_FLAG_TENANT_RBAC",
  automated_provisioning: "VITE_FLAG_AUTOMATED_PROVISIONING",
  strict_finance_access: "VITE_FLAG_STRICT_FINANCE_ACCESS",
};

function readEnvFlag(key: TenantFlagKey): boolean {
  const envName = ENV_FLAG_BY_KEY[key];
  const value = (import.meta.env[envName] as string | undefined) ?? "false";
  return value === "true";
}

/**
 * Feature flags por tenant (Supabase) + override global por entorno (staging / kill-switch).
 * Cuenta `legacy_protected` (p. ej. hessen@test.io): los flags de producto no restringen su modo actual;
 * el hook expone `legacyUser` para bifurcar UI si hiciera falta.
 */
export function useFeatureFlags() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id ?? undefined;
  const legacyUser = Boolean(user?.legacy_protected);

  const flagsQuery = useQuery({
    queryKey: ["tenant_feature_flags", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_feature_flags")
        .select("flag_key, enabled")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      const map = new Map<string, boolean>();
      for (const row of data ?? []) {
        if (row.flag_key != null) map.set(row.flag_key, Boolean(row.enabled));
      }
      return map;
    },
  });

  const isFlagEnabled = useCallback(
    (key: TenantFlagKey) => {
      if (readEnvFlag(key)) return true;
      if (!tenantId) return false;
      return flagsQuery.data?.get(key) ?? false;
    },
    [tenantId, flagsQuery.data],
  );

  return useMemo(
    () => ({
      legacyUser,
      tenantId,
      isLoading: flagsQuery.isLoading,
      isError: flagsQuery.isError,
      refetch: flagsQuery.refetch,
      isFlagEnabled,
      /** Atajos explícitos para el plan investor-ready */
      investorReadySecurity: isFlagEnabled("investor_ready_security"),
      tenantRbac: isFlagEnabled("tenant_rbac"),
      automatedProvisioning: isFlagEnabled("automated_provisioning"),
      strictFinanceAccess: isFlagEnabled("strict_finance_access"),
    }),
    [
      legacyUser,
      tenantId,
      flagsQuery.isLoading,
      flagsQuery.isError,
      flagsQuery.refetch,
      isFlagEnabled,
    ],
  );
}
