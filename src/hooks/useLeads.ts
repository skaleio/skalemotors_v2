import { leadService } from '@/lib/services/leads'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/types/database'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId } from 'react'

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
  /** Suscripción realtime: refresca al instante cuando otro usuario asigna/edita un lead (CRM/Leads). */
  live?: boolean
}

export function useLeads(options: UseLeadsOptions = {}) {
  const {
    assignedTo,
    branchId,
    status,
    source,
    search,
    enabled = true,
    refetchOnWindowFocus = false,
    refetchOnMount = false,
    live = false,
  } = options

  const queryClient = useQueryClient()
  const channelId = useId()
  const queryKey = ['leads', branchId, assignedTo, status, source, search]

  const { data: leads = [], isLoading: loading, isFetching, error, refetch } = useQuery({
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
    refetchOnWindowFocus: live ? true : refetchOnWindowFocus,
    refetchOnMount: live ? true : refetchOnMount,
    retry: 2,
    // Mostrar datos en caché mientras se actualiza (evita "Cargando leads" en cada entrada)
    placeholderData: (previousData) => previousData,
  })

  // Realtime: cualquier cambio en `leads` (asignación, estado, edición) invalida la lista.
  // RLS sobre la publicación garantiza que cada vendedor solo recibe eventos de sus leads.
  useEffect(() => {
    if (!live || !enabled) return
    const channel = supabase
      .channel(`leads-rt-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [live, enabled, channelId, queryClient])

  return {
    leads: leads as Lead[],
    loading,
    isFetching,
    error: error as Error | null,
    refetch,
  }
}
