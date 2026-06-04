import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_MONTHLY_SALES_GOAL } from "@/lib/sellerPerformance";
import { supabase } from "@/lib/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useTenantSalesGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenant_id;

  const query = useQuery({
    queryKey: ["tenant-sales-goal", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("default_monthly_sales_goal")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      const n = Number(data?.default_monthly_sales_goal);
      return n > 0 ? n : DEFAULT_MONTHLY_SALES_GOAL;
    },
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (goal: number) => {
      if (!tenantId) throw new Error("Sin tenant");
      const { error } = await supabase
        .from("tenants")
        .update({ default_monthly_sales_goal: goal, updated_at: new Date().toISOString() })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-sales-goal", tenantId] });
    },
  });

  return {
    goal: query.data ?? DEFAULT_MONTHLY_SALES_GOAL,
    isLoading: query.isLoading,
    updateGoal: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
