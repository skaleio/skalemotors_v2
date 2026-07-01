import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

type StaffBranchRow = {
  full_name: string | null;
  branch: { name: string | null } | { name: string | null }[] | null;
};

/**
 * Mapa nombre_vendedor (normalizado) → sucursal, tomado de la plantilla de
 * Finanzas → Vendedores (`branch_sales_staff`). Es la fuente de verdad de la
 * sucursal del vendedor para etiquetar avisos, no el branch del lead.
 */
export function useStaffBranchByName({
  tenantId,
  enabled = true,
}: {
  tenantId?: string | null;
  enabled?: boolean;
}) {
  const query = useQuery({
    queryKey: ["staff_branch_by_name", tenantId ?? null],
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from("branch_sales_staff")
        .select("full_name, branch:branches(name)")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true);
      if (error) throw error;

      const map = new Map<string, string>();
      for (const row of (data ?? []) as StaffBranchRow[]) {
        const name = row.full_name?.trim();
        if (!name) continue;
        const branchObj = Array.isArray(row.branch) ? row.branch[0] : row.branch;
        const branchName = branchObj?.name?.trim();
        if (branchName) map.set(name.toLocaleLowerCase("es"), branchName);
      }
      return map;
    },
  });

  return {
    branchByName: query.data ?? new Map<string, string>(),
    loading: query.isLoading,
  };
}
