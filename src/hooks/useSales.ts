import { saleService } from "@/lib/services/sales";
import type { Database } from "@/lib/types/database";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SaleRow = Database["public"]["Tables"]["sales"]["Row"];
export type SaleInsert = Database["public"]["Tables"]["sales"]["Insert"];
export type SaleUpdate = Database["public"]["Tables"]["sales"]["Update"];

export type SaleWithRelations = SaleRow & {
  lead?: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
  vehicle?: { id: string; make: string; model: string; year: number; vin: string } | null;
  seller?: { id: string; full_name: string; email: string | null } | null;
  branch?: { id: string; name: string } | null;
};

interface UseSalesOptions {
  branchId?: string | null;
  sellerId?: string;
  status?: string;
  enabled?: boolean;
  staleTime?: number;
}

export function useSales(options: UseSalesOptions = {}) {
  const {
    branchId,
    sellerId,
    status,
    enabled = true,
    staleTime = 3 * 60 * 1000,
  } = options;

  const queryClient = useQueryClient();
  const queryKey = ["sales", branchId, sellerId, status];

  const { data: sales = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => saleService.getAll({ branchId: branchId ?? undefined, sellerId, status }),
    enabled,
    staleTime,
    refetchOnWindowFocus: true,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["sales-stats", branchId],
    queryFn: () => saleService.getStats(undefined, branchId ?? undefined, 30),
    enabled,
    staleTime,
  });

  const createMutation = useMutation({
    mutationFn: (sale: SaleInsert) => saleService.create(sale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: SaleUpdate }) => saleService.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => saleService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousSales = queryClient.getQueryData<SaleWithRelations[]>(queryKey);
      queryClient.setQueryData<SaleWithRelations[]>(queryKey, (old) =>
        old ? old.filter((s) => s.id !== id) : old
      );
      return { previousSales };
    },
    onError: (_err, _id, context) => {
      if (context?.previousSales != null) {
        queryClient.setQueryData(queryKey, context.previousSales);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
    },
  });

  return {
    sales: sales as SaleWithRelations[],
    stats: stats ?? null,
    isLoading,
    statsLoading,
    error,
    refetch,
    createSale: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateSale: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteSale: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
