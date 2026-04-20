import { supabase } from '@/lib/supabase'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/types/database'

export type PendingTask = Database['public']['Tables']['pending_tasks']['Row']
const ENABLE_PENDING_TASK_SYNC_RPCS = false

export function usePendingTasks(branchId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['pending-tasks', branchId],
    queryFn: async (): Promise<PendingTask[]> => {
      if (!branchId) return []
      if (ENABLE_PENDING_TASK_SYNC_RPCS) {
        // Sincronizar recordatorios (opcional: si la RPC no existe en el proyecto, se omite)
        await supabase.rpc('sync_lead_reminders_to_pending_tasks', { ventana_horas: 48 }).then(({ error }) => {
          const rpcNotFound = error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
          if (error && !rpcNotFound) console.warn('sync_lead_reminders_to_pending_tasks:', error.message)
        })
        // Avisos: vehículos mucho tiempo en inventario (opcional: si la RPC no existe, se omite)
        await supabase.rpc('sync_old_inventory_vehicles_to_pending_tasks', { dias_inventario: 45, dias_sin_modificar: 30 }).then(({ error }) => {
          const rpcNotFound = error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
          if (error && !rpcNotFound) console.warn('sync_old_inventory_vehicles_to_pending_tasks:', error.message)
        })
      }
      // Staleness de consignaciones (admin-only; la RPC se auto-gateea por rol).
      // Se ejecuta siempre: el server devuelve 0/0 si el usuario no es admin.
      await supabase
        .rpc('sync_stale_consignaciones_to_pending_tasks', { dias_sin_publicar: 7 })
        .then(({ error }) => {
          const rpcNotFound =
            error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
          if (error && !rpcNotFound)
            console.warn('sync_stale_consignaciones_to_pending_tasks:', error.message)
        })
      const { data, error } = await supabase
        .from('pending_tasks')
        .select('*')
        .eq('branch_id', branchId)
        .is('completed_at', null)
        .order('due_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      const list = data ?? []
      // Ordenar por prioridad: urgent → today → later
      const order: Record<string, number> = { urgent: 0, today: 1, later: 2 }
      return [...list].sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2))
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData: PendingTask[] | undefined) => previousData ?? [],
  })

  const urgentCount = (query.data ?? []).filter((t) => t.priority === 'urgent').length
  const urgentTasks = (query.data ?? []).filter((t) => t.priority === 'urgent')
  const todayTasks = (query.data ?? []).filter((t) => t.priority === 'today')
  const laterTasks = (query.data ?? []).filter((t) => t.priority === 'later')

  return {
    tasks: query.data ?? [],
    urgentCount,
    urgentTasks,
    todayTasks,
    laterTasks,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    queryClient,
  }
}

export function useCompletePendingTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('pending_tasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] })
    },
  })
}
