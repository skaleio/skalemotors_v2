import { leadService } from '@/lib/services/leads'
import type { Database } from '@/lib/types/database'
import { useQuery } from '@tanstack/react-query'

type Lead = Database['public']['Tables']['leads']['Row']

// Hook para obtener los leads en papelera.
// Solo depende del flag "enabled" (por ejemplo, si el diálogo de papelera está abierto).
export function useDeletedLeads(enabled: boolean) {
  const queryKey = ['leads', 'deleted']

  const { data: deletedLeads = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => leadService.getDeleted(),
    enabled,
    staleTime: 1 * 60 * 1000,
  })

  return {
    deletedLeads: deletedLeads as Lead[],
    loading,
    refetch,
  }
}
