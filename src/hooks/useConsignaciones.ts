import { consignacionesService } from "@/lib/services/consignaciones";
import type { Database } from "@/lib/types/database";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Consignacion = Database["public"]["Tables"]["consignaciones"]["Row"];

type ConsignacionWithRelations = Consignacion & {
  lead?: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    tags: unknown;
  } | null;
  vehicle?: {
    id: string;
    make: string | null;
    model: string | null;
    year: number | null;
    vin: string | null;
    color: string | null;
    images: unknown;
  } | null;
};

interface UseConsignacionesOptions {
  branchId?: string;
  status?: string;
  search?: string;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
}

export function useConsignaciones(options: UseConsignacionesOptions = {}) {
  const {
    branchId,
    status,
    search,
    enabled = true,
    staleTime = 5 * 60 * 1000,
    gcTime = 10 * 60 * 1000,
  } = options;

  const queryClient = useQueryClient();
  const queryKey = ["consignaciones", branchId, status, search];

  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const result = await consignacionesService.getAll({
          branchId,
          status,
          search,
        });
        console.log(`✅ Cargadas ${result.length} consignaciones`);
        return result || [];
      } catch (err) {
        const fetchError = err as Error;
        console.error("❌ Error fetching consignaciones:", fetchError);
        console.error("Error details:", {
          message: fetchError.message,
          stack: fetchError.stack,
        });
        throw fetchError;
      }
    },
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
  });

  const setConsignaciones = (
    updater:
      | ConsignacionWithRelations[]
      | ((prev: ConsignacionWithRelations[]) => ConsignacionWithRelations[]),
  ) => {
    queryClient.setQueryData<ConsignacionWithRelations[]>(queryKey, (prev = []) =>
      typeof updater === "function"
        ? (updater as (items: ConsignacionWithRelations[]) => ConsignacionWithRelations[])(prev)
        : updater,
    );
  };

  return {
    consignaciones: (data || []) as ConsignacionWithRelations[],
    loading,
    error: error as Error | null,
    refetch,
    setConsignaciones,
  };
}
