import { supabase } from '@/lib/supabase'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@/lib/types/database'

export type PendingTask = Database['public']['Tables']['pending_tasks']['Row']
const ENABLE_PENDING_TASK_SYNC_RPCS = false

type UsePendingTasksOptions = {
  branchId?: string | null
  tenantId?: string | null
  role?: string | null
}

// Backward compat: acepta un string (branchId) como en la versión anterior,
// o un objeto con contexto completo del usuario (branchId + tenantId + role).
type UsePendingTasksInput = string | null | undefined | UsePendingTasksOptions

export function usePendingTasks(input: UsePendingTasksInput) {
  const queryClient = useQueryClient()

  const opts: UsePendingTasksOptions =
    typeof input === 'string' || input == null
      ? { branchId: input ?? null }
      : input

  const { branchId, tenantId, role } = opts
  const isAdminWide = role === 'admin' || role === 'jefe_jefe'

  // enabled: admin/jefe_jefe necesita tenantId; el resto necesita branchId
  const enabled = isAdminWide ? !!tenantId : !!branchId

  const query = useQuery({
    queryKey: ['pending-tasks', { branchId, tenantId, role, scope: isAdminWide ? 'tenant' : 'branch' }],
    queryFn: async (): Promise<PendingTask[]> => {
      if (!enabled) return []

      if (ENABLE_PENDING_TASK_SYNC_RPCS) {
        await supabase.rpc('sync_lead_reminders_to_pending_tasks', { ventana_horas: 48 }).then(({ error }) => {
          const rpcNotFound = error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
          if (error && !rpcNotFound) console.warn('sync_lead_reminders_to_pending_tasks:', error.message)
        })
        await supabase.rpc('sync_old_inventory_vehicles_to_pending_tasks', { dias_inventario: 45, dias_sin_modificar: 30 }).then(({ error }) => {
          const rpcNotFound = error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
          if (error && !rpcNotFound) console.warn('sync_old_inventory_vehicles_to_pending_tasks:', error.message)
        })
      }

      // Staleness RPCs (admin-only; auto-gate interno, seguros de llamar por otros roles).
      await Promise.all([
        supabase.rpc('sync_stale_consignaciones_to_pending_tasks', { dias_sin_publicar: 7 }).then(({ error }) => {
          const rpcNotFound = error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
          if (error && !rpcNotFound) console.warn('sync_stale_consignaciones_to_pending_tasks:', error.message)
        }),
        supabase.rpc('sync_stale_leads_to_pending_tasks', { dias_sin_movimiento: 3 }).then(({ error }) => {
          const rpcNotFound = error?.code === 'PGRST202' || error?.message?.includes('Could not find the function')
          if (error && !rpcNotFound) console.warn('sync_stale_leads_to_pending_tasks:', error.message)
        }),
      ])

      // Scope de lectura: admin/jefe_jefe = tenant-wide; otros = su branch.
      let q = supabase
        .from('pending_tasks')
        .select('*')
        .is('completed_at', null)
        .order('due_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false })

      if (isAdminWide && tenantId) {
        q = q.eq('tenant_id', tenantId)
      } else if (branchId) {
        q = q.eq('branch_id', branchId)
      } else {
        return []
      }

      const { data, error } = await q
      if (error) throw error
      const list = data ?? []
      const order: Record<string, number> = { urgent: 0, today: 1, later: 2 }
      return [...list].sort((a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2))
    },
    enabled,
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
