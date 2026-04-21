import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface BranchSeller {
  id: string;
  full_name: string;
  email: string | null;
  branch_id: string | null;
  role: string;
}

type SellerRole = "vendedor" | "jefe_sucursal";

interface UseBranchSellersOptions {
  tenantId?: string | null;
  branchId?: string | null;
  enabled?: boolean;
  roles?: SellerRole[];
  scope?: "branch" | "tenant";
}

const DEFAULT_ROLES: SellerRole[] = ["vendedor", "jefe_sucursal"];

export function useBranchSellers({
  tenantId,
  branchId,
  enabled = true,
  roles = DEFAULT_ROLES,
  scope = "branch",
}: UseBranchSellersOptions) {
  const rolesKey = roles.slice().sort().join(",");
  const queryKey = ["branch_sellers", tenantId ?? null, scope, branchId ?? null, rolesKey];

  const query = useQuery({
    queryKey,
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<BranchSeller[]> => {
      let q = supabase
        .from("users")
        .select("id, full_name, email, branch_id, role")
        .eq("tenant_id", tenantId!)
        .in("role", roles)
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (scope === "branch" && branchId) {
        q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BranchSeller[];
    },
  });

  return {
    sellers: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
  };
}
