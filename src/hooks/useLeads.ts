import { leadService } from '@/lib/services/leads'
import type { Database } from '@/lib/types/database'
import { useQuery } from '@tanstack/react-query'

type Lead = Database['public']['Tables']['leads']['Row']

interface UseLeadsOptions {
  assignedTo?: string
  branchId?: string
  status?: string
  source?: string
  search?: string
  enabled?: boolean
  refetchOnWindowFocus?: boolean
  refetchOnMount?: boolean
}

export function useLeads(options: UseLeadsOptions = {}) {
  const {
    assignedTo,
    branchId,
    status,
    source,
    search,
    enabled = true,
    refetchOnWindowFocus = true,
    refetchOnMount = true,
  } = options

  const queryKey = ['leads', branchId, assignedTo, status, source, search]

  const { data: leads = [], isLoading: loading, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      leadService.getAll({
        assignedTo,
        branchId,
        status,
        source,
        search,
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus,
    refetchOnMount,
    retry: 2,
  })

  return {
    leads: leads as Lead[],
    loading,
    error: error as Error | null,
    refetch,
  }
}


