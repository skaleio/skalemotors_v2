import { leadService } from '@/lib/services/leads'
import type { Database } from '@/lib/types/database'
import { useQuery } from '@tanstack/react-query'

type Lead = Database['public']['Tables']['leads']['Row']

export function useDeletedLeads(branchId: string | undefined, enabled: boolean) {
  const queryKey = ['leads', 'deleted', branchId]

  const { data: deletedLeads = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => leadService.getDeleted(branchId!),
    enabled: Boolean(branchId) && enabled,
    staleTime: 1 * 60 * 1000,
  })

  return {
    deletedLeads: deletedLeads as Lead[],
    loading,
    refetch,
  }
}
