import { supabase } from '@/lib/supabase'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/types/database'

export type PendingTask = Database['public']['Tables']['pending_tasks']['Row']

export function usePendingTasks(branchId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['pending-tasks', branchId],
    queryFn: async (): Promise<PendingTask[]> => {
      if (!branchId) return []
      // Sincronizar recordatorios: entran en Tareas pendientes 2 días antes de la fecha
      await supabase.rpc('sync_lead_reminders_to_pending_tasks', { ventana_horas: 48 }).then(({ error }) => {
        if (error) console.warn('sync_lead_reminders_to_pending_tasks:', error.message)
      })
      // Avisos: vehículos mucho tiempo en inventario sin modificar (45+ días, sin cambios 30+ días)
      await supabase.rpc('sync_old_inventory_vehicles_to_pending_tasks', { dias_inventario: 45, dias_sin_modificar: 30 }).then(({ error }) => {
        if (error) console.warn('sync_old_inventory_vehicles_to_pending_tasks:', error.message)
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
