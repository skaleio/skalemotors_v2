import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getAal, listFactors } from "@/lib/services/mfa";
import { MFA_GATE_ENABLED, roleRequiresMfa } from "@/lib/mfaPolicy";

export type MfaGateState = {
  loading: boolean;
  mustEnroll: boolean;
  mustVerify: boolean;
  hasVerifiedFactor: boolean;
};

export function useMfaGate(): MfaGateState {
  const { user, session } = useAuth();
  const enabled = MFA_GATE_ENABLED && Boolean(session && user);

  const factorsQuery = useQuery({
    queryKey: ["mfa", "factors", user?.id],
    queryFn: listFactors,
    enabled,
    staleTime: 30_000,
  });

  const aalQuery = useQuery({
    queryKey: ["mfa", "aal", user?.id],
    queryFn: getAal,
    enabled,
    staleTime: 10_000,
  });

  const verified = (factorsQuery.data ?? []).filter((f) => f.status === "verified");
  const hasVerifiedFactor = verified.length > 0;
  const privileged = roleRequiresMfa(user?.role);

  const current = aalQuery.data?.currentLevel ?? null;
  const next = aalQuery.data?.nextLevel ?? null;
  const mustVerify =
    MFA_GATE_ENABLED && hasVerifiedFactor && next === "aal2" && current !== "aal2";
  const mustEnroll = MFA_GATE_ENABLED && privileged && !hasVerifiedFactor;

  const loading = enabled && (factorsQuery.isLoading || aalQuery.isLoading);

  return {
    loading,
    mustEnroll,
    mustVerify,
    hasVerifiedFactor,
  };
}
